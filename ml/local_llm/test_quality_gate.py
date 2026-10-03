"""Guard statistical support and recall as well as point-estimate false flags."""
import unittest

from train import metrics, quality_gate


class QualityGateTest(unittest.TestCase):
    def test_low_false_flags_alone_cannot_pass(self):
        rows = [{'label': 'A'}] * 600 + [{'label': label} for label in ('B', 'C', 'E', 'F') for _ in range(100)]
        predictions = [row['label'] for row in rows]
        self.assertTrue(quality_gate(metrics(rows, predictions)))
        self.assertFalse(quality_gate(metrics(rows, ['A'] * len(rows))))
        predictions[:2] = ['B', 'B']
        result = metrics(rows, predictions)
        self.assertLess(result['benignFalseFlagRate'], .01)
        self.assertFalse(quality_gate(result))  # Upper confidence bound exceeds 1%.
        with self.assertRaises(ValueError):
            metrics(rows, predictions[:-1])


if __name__ == '__main__':
    unittest.main()
