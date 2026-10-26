#!/bin/bash
export PYTHONPATH=.
export DATA_DIR=data/matches
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
