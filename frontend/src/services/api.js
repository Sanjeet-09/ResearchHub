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
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('rh_token') : null;
    const headers = {
      'Content-Type': file.type || 'application/octet-stream',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await axios.post(uploadUrl, file, {
      headers,
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
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('rh_token') : null;
    const headers = {
      'Content-Type': file.type || 'application/octet-stream',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await axios.post(uploadUrl, file, {
      headers,
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

// Document API endpoints
export const documentApi = {
  getDocuments: async (projectId, params = {}) => {
    const res = await api.get(`/projects/${projectId}/documents`, { params });
    return res.data;
  },

  getDocumentById: async (projectId, documentId) => {
    const res = await api.get(`/projects/${projectId}/documents/${documentId}`);
    return res.data.document;
  },

  getUploadUrl: async (projectId, uploadData) => {
    const res = await api.post(`/projects/${projectId}/documents/upload-url`, uploadData);
    return res.data;
  },

  uploadFileBinary: async (uploadUrl, file, onProgress) => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('rh_token') : null;
    const headers = {
      'Content-Type': file.type || 'application/octet-stream',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await axios.post(uploadUrl, file, {
      headers,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  createDocument: async (projectId, documentData) => {
    const res = await api.post(`/projects/${projectId}/documents`, documentData);
    return res.data.document;
  },

  updateDocument: async (projectId, documentId, documentData) => {
    const res = await api.patch(`/projects/${projectId}/documents/${documentId}`, documentData);
    return res.data.document;
  },

  deleteDocument: async (projectId, documentId) => {
    const res = await api.delete(`/projects/${projectId}/documents/${documentId}`);
    return res.data;
  },

  getDownloadUrl: async (projectId, documentId) => {
    const res = await api.get(`/projects/${projectId}/documents/${documentId}/download`);
    return res.data.downloadUrl || res.data;
  },

  searchDocuments: async (projectId, q) => {
    const res = await api.get(`/projects/${projectId}/documents/search`, { params: { q } });
    return res.data.documents;
  },
};

// Publication API endpoints
export const publicationApi = {
  getPublications: async (projectId, params = {}) => {
    const res = await api.get(`/projects/${projectId}/publications`, { params });
    return res.data.publications;
  },

  getPublicationById: async (projectId, publicationId) => {
    const res = await api.get(`/projects/${projectId}/publications/${publicationId}`);
    return res.data;
  },

  createPublication: async (projectId, pubData) => {
    const res = await api.post(`/projects/${projectId}/publications`, pubData);
    return res.data.publication;
  },

  updatePublication: async (projectId, publicationId, pubData) => {
    const res = await api.patch(`/projects/${projectId}/publications/${publicationId}`, pubData);
    return res.data.publication;
  },

  deletePublication: async (projectId, publicationId) => {
    const res = await api.delete(`/projects/${projectId}/publications/${publicationId}`);
    return res.data;
  },

  addLink: async (projectId, publicationId, linkData) => {
    const res = await api.post(`/projects/${projectId}/publications/${publicationId}/links`, linkData);
    return res.data;
  },

  removeLink: async (projectId, publicationId, linkData) => {
    const res = await api.delete(`/projects/${projectId}/publications/${publicationId}/links`, { data: linkData });
    return res.data;
  },

  getTrace: async (projectId, publicationId) => {
    const res = await api.get(`/projects/${projectId}/publications/${publicationId}/trace`);
    return res.data;
  },
};

// Equipment & Reservations API endpoints
export const equipmentApi = {
  getEquipment: async (params = {}) => {
    const res = await api.get('/equipment', { params });
    return res.data.equipment;
  },

  getEquipmentById: async (id) => {
    const res = await api.get(`/equipment/${id}`);
    return res.data.equipment;
  },

  createEquipment: async (equipmentData) => {
    const res = await api.post('/equipment', equipmentData);
    return res.data.equipment;
  },

  updateEquipment: async (id, equipmentData) => {
    const res = await api.patch(`/equipment/${id}`, equipmentData);
    return res.data.equipment;
  },

  deleteEquipment: async (id) => {
    const res = await api.delete(`/equipment/${id}`);
    return res.data;
  },

  getCalendar: async (equipmentId, from, to) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await api.get(`/equipment/${equipmentId}/calendar`, { params });
    return res.data;
  },

  createReservation: async (reservationData) => {
    const res = await api.post('/reservations', reservationData);
    return res.data.reservation;
  },

  getMyReservations: async () => {
    const res = await api.get('/reservations/mine');
    return res.data.reservations;
  },

  getReservationHistory: async (params = {}) => {
    const res = await api.get('/reservations/history', { params });
    return res.data;
  },

  cancelReservation: async (id) => {
    const res = await api.patch(`/reservations/${id}/cancel`);
    return res.data;
  },
};

// Activity, Audit & Presence API
export const activityApi = {
  getProjectTimeline: async (projectId, params = {}) => {
    const res = await api.get(`/projects/${projectId}/timeline`, { params });
    return res.data;
  },

  getAuditLogs: async (params = {}) => {
    const res = await api.get('/audit', { params });
    return res.data;
  },

  sendPresenceHeartbeat: async (data = {}) => {
    const res = await api.post('/activity/presence/heartbeat', data);
    return res.data;
  },

  getProjectPresence: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/presence`);
    return res.data;
  },
};

// Notification API
export const notificationApi = {
  getNotifications: async (params = {}) => {
    const res = await api.get('/notifications', { params });
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data.notification;
  },

  markAllAsRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
  },
};

// Lab API endpoints (Testing Environment & Sessions)
export const labApi = {
  getProfiles: async () => {
    const res = await api.get('/lab/profiles');
    return res.data.profiles;
  },

  createSession: async (sessionData) => {
    const res = await api.post('/lab/sessions', sessionData);
    return res.data.session;
  },

  getSessions: async (params = {}) => {
    const res = await api.get('/lab/sessions', { params });
    return res.data.sessions;
  },

  getSessionById: async (id) => {
    const res = await api.get(`/lab/sessions/${id}`);
    return res.data.session;
  },

  pauseSession: async (id) => {
    const res = await api.post(`/lab/sessions/${id}/pause`);
    return res.data.session;
  },

  resumeSession: async (id) => {
    const res = await api.post(`/lab/sessions/${id}/resume`);
    return res.data.session;
  },

  stopSession: async (id, exportNotebooks = false) => {
    const res = await api.post(`/lab/sessions/${id}/stop`, { exportNotebooks });
    return res.data.session;
  },

  exportNotebooks: async (id) => {
    const res = await api.post(`/lab/sessions/${id}/export`);
    return res.data;
  },
};



