# Implementation Plan — Security Gamification System

This plan outlines the steps to implement a gamification framework into the Human Firewall platform. The system will track security scores (points) and award badges based on employee actions (phishing clicks vs. threat reports) and display a leaderboard on the dashboard.

---

## Proposed Changes

### 1. Database Layer

#### [MODIFY] [database.py](file:///C:/Human_Firewall/backend/database.py)
*   **Schema Update**:
    *   Modify `init_db()` to automatically append `points` (INTEGER, default 100) and `badges` (TEXT, default 'Guardian') columns to the `user_history` table if they do not exist.
*   **Helper Functions**:
    *   `update_user_points(email, change_amount)`: Increments or decrements an employee's score, clamping it between 0 and 150.
    *   `get_user_by_telegram_id(chat_id)`: Helper to map incoming Telegram reports to email addresses.
    *   `get_leaderboard_data()`: Queries and computes:
        1.  **Top 5 Employees**: List of employees sorted by points descending, including assigned badges.
        2.  **Division Rankings**: List of divisions grouped by average employee points, sorted descending.

---

### 2. Backend & API Layer

#### [MODIFY] [app.py](file:///C:/Human_Firewall/backend/app.py)
*   **Integrate Point Deductions (Flow A)**:
    *   Inside `/redirect-handler` (simulation link clicked): Deduct **10 points** from the target's score.
    *   Inside `/api/fake-login-submit` (credentials compromised): Deduct **20 points** from the target's score.
*   **Integrate Point Rewards (Flow B)**:
    *   Inside `POST /api/incidents`: If the incident is a valid user report (`source_type = 'real_world_report'`), map the reporting `telegram_chat_id` to their email and award **15 points** for positive reporting.
*   **New API Route**:
    *   `GET /api/leaderboard`: Returns a JSON payload containing the top employees and division rankings for frontend rendering.

---

### 3. Frontend UI Layer

#### [MODIFY] [dashboard.html](file:///C:/Human_Firewall/backend/templates/dashboard.html)
*   **Navigation & Tabs**:
    *   Add a third navigation tab: **"Security Leaderboard"** at the topbar.
*   **Leaderboard Layout & Styling**:
    *   Create a dual-panel layout under the leaderboard tab:
        1.  **Division Standings**: A progress bar list showing division rankings with average security scores.
        2.  **Top Security Champions**: A table displaying top-performing employees, their points, and animated badge elements:
            *   🏆 **Sentinel** (Points >= 110)
            *   🛡️ **Guardian** (Points 90-109)
            *   ⚠️ **Vulnerable** (Points < 90)
*   **AJAX Polling**:
    *   Integrate a periodic fetch to `GET /api/leaderboard` to dynamically update the rankings and progress bars without refreshing the page.

---

## Verification Plan

### Automated/Manual Verification
1.  **Database Migration**: Run the server and inspect `human_firewall.db` to ensure `points` and `badges` columns are added to existing rows.
2.  **Simulation Click Deduction**: Open a redirect-handler URL for Rina Kusuma (`rina.kusuma@netengineering-dummy.local`) and verify her points drop from 100 to 90 in the database.
3.  **Threat Report Reward**: Simulate a dangerous incident creation from a user and verify their points increase by 15.
4.  **UI Render**: Open the dashboard, click the Leaderboard tab, and verify that the standings and champion badges display correctly and updates dynamically.
