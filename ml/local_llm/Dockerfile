FROM python:3.10-slim@sha256:c1aaf3d03e14944a039a1647e0b3f6f34c6bee517bac6ff380215ee099c4e808
WORKDIR /work
# Training dependencies stay out of Flask and the proxy hot path.
RUN pip install --no-cache-dir pip==25.2 setuptools==80.9.0 wheel==0.45.1 typing_extensions==4.14.1
RUN pip install --no-cache-dir torch==2.7.1 --index-url https://download.pytorch.org/whl/cu126
RUN pip install --no-cache-dir transformers==4.57.1 peft==0.17.1 accelerate==1.10.1 bitsandbytes==0.48.1 tldextract==5.3.0
# Triton compiles a small CUDA host helper on first GPU use.
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && apt-get clean
ENV TOKENIZERS_PARALLELISM=false HF_HUB_DISABLE_TELEMETRY=1
CMD ["python", "ml/local_llm/train.py", "--help"]
