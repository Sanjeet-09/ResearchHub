FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user 'labuser'
RUN useradd -m -u 1000 -s /bin/bash labuser && \
    mkdir -p /workspace /etc/jupyter /home/labuser/.jupyter/lab/user-settings/@jupyterlab/apputils-extension && \
    chown -R labuser:labuser /workspace /etc/jupyter /home/labuser

# Install Python packages for Profiles 1-3 (Basic, Standard, High-Memory) + dill
RUN pip install --no-cache-dir \
    jupyterlab==4.2.5 \
    numpy pandas matplotlib \
    scipy scikit-learn seaborn statsmodels openpyxl \
    polars pyarrow dask duckdb \
    dill

# Copy config and theme overrides
COPY jupyter_server_config.py /etc/jupyter/jupyter_server_config.py
COPY overrides.json /opt/conda/share/jupyter/lab/settings/overrides.json
COPY overrides.json /home/labuser/.jupyter/lab/user-settings/@jupyterlab/apputils-extension/themes.json
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chown -R labuser:labuser /home/labuser /etc/jupyter

USER labuser
WORKDIR /workspace

ENV PORT=8888
ENV HOME=/home/labuser
EXPOSE 8888

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
