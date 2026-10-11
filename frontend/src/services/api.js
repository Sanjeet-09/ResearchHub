import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: Attach JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rh_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('rh_token');
      localStorage.removeItem('rh_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authApi = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (email, password, fullName) => {
    const res = await api.post('/auth/register', { email, password, fullName });
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data.user;
  },

  getUsers: async (params = {}) => {
    const res = await api.get('/auth/users', { params });
    return res.data.users;
  },

  updateUserRole: async (userId, role) => {
    const res = await api.patch(`/auth/users/${userId}/role`, { role });
    return res.data.user;
  },

  updateUserStatus: async (userId, isActive) => {
    const res = await api.patch(`/auth/users/${userId}/status`, { isActive });
    return res.data.user;
  },
};

// Project API endpoints
export const projectApi = {
  getProjects: async () => {
    const res = await api.get('/projects');
    return res.data.projects;
  },

  getProjectById: async (id) => {
    const res = await api.get(`/projects/${id}`);
    return res.data.project;
  },

  createProject: async (projectData) => {
    const res = await api.post('/projects', projectData);
    return res.data.project;
  },

  updateProject: async (id, projectData) => {
    const res = await api.patch(`/projects/${id}`, projectData);
    return res.data.project;
  },

  updateProjectStatus: async (id, status) => {
    const res = await api.patch(`/projects/${id}/status`, { status });
    return res.data.project;
  },

  deleteProject: async (id) => {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
  },

  addMember: async (projectId, userId, projectRole) => {
    const res = await api.post(`/projects/${projectId}/members`, { userId, projectRole });
    return res.data.member;
  },

  removeMember: async (projectId, userId) => {
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    return res.data;
  },

  createMilestone: async (projectId, milestoneData) => {
    const res = await api.post(`/projects/${projectId}/milestones`, milestoneData);
    return res.data.milestone;
  },

  updateMilestone: async (projectId, milestoneId, milestoneData) => {
    const res = await api.patch(`/projects/${projectId}/milestones/${milestoneId}`, milestoneData);
    return res.data.milestone;
  },

  deleteMilestone: async (projectId, milestoneId) => {
    const res = await api.delete(`/projects/${projectId}/milestones/${milestoneId}`);
    return res.data;
  },
};

// Experiment API endpoints
export const experimentApi = {
  getExperiments: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/experiments`);
    return res.data.experiments;
  },

  getExperimentById: async (projectId, experimentId) => {
    const res = await api.get(`/projects/${projectId}/experiments/${experimentId}`);
    return res.data;
  },

  createExperiment: async (projectId, experimentData) => {
    const res = await api.post(`/projects/${projectId}/experiments`, experimentData);
    return res.data.experiment;
  },

  updateExperiment: async (projectId, experimentId, experimentData) => {
    const res = await api.patch(`/projects/${projectId}/experiments/${experimentId}`, experimentData);
    return res.data.experiment;
  },

  deleteExperiment: async (projectId, experimentId) => {
    const res = await api.delete(`/projects/${projectId}/experiments/${experimentId}`);
    return res.data;
  },

  getUploadUrl: async (projectId, experimentId, fileData) => {
    const res = await api.post(`/projects/${projectId}/experiments/${experimentId}/files/upload-url`, fileData);
    return res.data;
  },

  uploadFileBinary: async (uploadUrl, file, onProgress) => {
    const res = await axios.post(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  confirmFileUpload: async (projectId, experimentId, confirmData) => {
    const res = await api.post(`/projects/${projectId}/experiments/${experimentId}/files/confirm`, confirmData);
    return res.data.file;
  },

  getDownloadUrl: async (projectId, experimentId, fileId) => {
    const res = await api.get(`/projects/${projectId}/experiments/${experimentId}/files/${fileId}/download`);
    return res.data;
  },

  deleteFile: async (projectId, experimentId, fileId) => {
    const res = await api.delete(`/projects/${projectId}/experiments/${experimentId}/files/${fileId}`);
    return res.data;
  },

  getExperimentLinks: async (experimentId) => {
    const res = await api.get(`/experiments/${experimentId}/links`);
    return res.data.links;
  },
};

// Dataset API endpoints
export const datasetApi = {
  getDatasets: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/datasets`);
    return res.data.datasets;
  },

  getDatasetById: async (projectId, datasetId) => {
    const res = await api.get(`/projects/${projectId}/datasets/${datasetId}`);
    return res.data;
  },

  createDataset: async (projectId, datasetData) => {
    const res = await api.post(`/projects/${projectId}/datasets`, datasetData);
    return res.data.dataset;
  },

  updateDataset: async (projectId, datasetId, datasetData) => {
    const res = await api.patch(`/projects/${projectId}/datasets/${datasetId}`, datasetData);
    return res.data.dataset;
  },

  deleteDataset: async (projectId, datasetId) => {
    const res = await api.delete(`/projects/${projectId}/datasets/${datasetId}`);
    return res.data;
  },

  // Version Control
  getVersionUploadUrl: async (projectId, datasetId, fileData) => {
    const res = await api.post(`/projects/${projectId}/datasets/${datasetId}/versions/upload-url`, fileData);
    return res.data;
  },

  uploadFileBinary: async (uploadUrl, file, onProgress) => {
    const res = await axios.post(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  confirmVersion: async (projectId, datasetId, confirmData) => {
    const res = await api.post(`/projects/${projectId}/datasets/${datasetId}/versions`, confirmData);
    return res.data.version;
  },

  getVersionHistory: async (projectId, datasetId) => {
    const res = await api.get(`/projects/${projectId}/datasets/${datasetId}/versions`);
    return res.data.versions;
  },

  getVersionDownloadUrl: async (projectId, datasetId, versionId) => {
    const res = await api.get(`/projects/${projectId}/datasets/${datasetId}/versions/${versionId}/download`);
    return res.data;
  },

  restoreVersion: async (projectId, datasetId, versionId) => {
    const res = await api.post(`/projects/${projectId}/datasets/${datasetId}/versions/${versionId}/restore`);
    return res.data.version;
  },
};
