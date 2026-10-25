-- db/seed.sql
-- Initial seed data for ResearchHub OS

-- Demo users (Password123!)
INSERT INTO users (id, email, password_hash, full_name, role) VALUES
  ('a0000000-0000-0000-0000-000000000000', 'admin@university.edu', '$2b$12$hbEEDy31e0gHOwv4QoKwA.lBpY1p4lAAUQpmehszK7fnlshzN6uxC', 'System Administrator', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'prof@university.edu', '$2b$12$hbEEDy31e0gHOwv4QoKwA.lBpY1p4lAAUQpmehszK7fnlshzN6uxC', 'Prof. Eleanor Vance', 'professor'),
  ('a0000000-0000-0000-0000-000000000002', 'researcher@university.edu', '$2b$12$hbEEDy31e0gHOwv4QoKwA.lBpY1p4lAAUQpmehszK7fnlshzN6uxC', 'Dr. Alan Grant', 'researcher'),
  ('a0000000-0000-0000-0000-000000000003', 'student@university.edu', '$2b$12$hbEEDy31e0gHOwv4QoKwA.lBpY1p4lAAUQpmehszK7fnlshzN6uxC', 'Alex Chen', 'student')
ON CONFLICT (email) DO NOTHING;

-- 5 Lab Profiles per Section 8.2
INSERT INTO lab_profiles (id, key, name, description, category, cpu, memory_gb, gpu_type, gpu_count, image_uri, max_hours, est_cost_per_hour, sort_order, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'basic-cpu', 'Basic', 'Python 3.11, JupyterLab, numpy, pandas, matplotlib', 'general', '1 vCPU', 2, NULL, 0, 'lab-cpu-base:latest', 2, 0.05, 1, true),
  ('b0000000-0000-0000-0000-000000000002', 'standard-cpu', 'Standard', '+ scipy, scikit-learn, seaborn, statsmodels, openpyxl', 'general', '2 vCPU', 8, NULL, 0, 'lab-cpu-base:latest', 2, 0.10, 2, true),
  ('b0000000-0000-0000-0000-000000000003', 'highmem-cpu', 'High-Memory Data', '+ polars, pyarrow, dask, duckdb', 'general', '4 vCPU', 16, NULL, 0, 'lab-cpu-base:latest', 2, 0.20, 3, true),
  ('b0000000-0000-0000-0000-000000000004', 'ml-gpu', 'AI/ML — GPU', 'PyTorch (CUDA), torchvision, scikit-learn, xgboost, lightgbm', 'ai_ml', '4 vCPU', 16, 'NVIDIA L4 (24 GB)', 1, 'lab-ml-gpu:latest', 1, 0.70, 4, true),
  ('b0000000-0000-0000-0000-000000000005', 'dl-gpu-large', 'AI/ML — Deep Learning / LLM', '+ transformers, datasets, accelerate, peft, bitsandbytes, sentence-transformers', 'ai_ml', '8 vCPU', 32, 'NVIDIA L4 (24 GB)', 1, 'lab-ml-gpu:latest', 1, 1.20, 5, true)
ON CONFLICT (key) DO NOTHING;

-- Sample Equipment
INSERT INTO equipment (id, name, description, location, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Electron Microscope (SEM-500)', 'High-resolution scanning electron microscope', 'Building B - Room 102', true),
  ('c0000000-0000-0000-0000-000000000002', 'High-Performance Compute Cluster (Node A)', '64-core compute node with 256GB RAM', 'Data Center - Rack 4', true),
  ('c0000000-0000-0000-0000-000000000003', 'DNA Sequencer (SeqMaster 3000)', 'Next-gen genomic sequencing platform', 'Genomics Lab - Room 305', true)
ON CONFLICT (id) DO NOTHING;
