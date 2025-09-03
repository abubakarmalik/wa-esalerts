import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/base-url.js';

const getInitialAuth = () => {
  try {
    const stored = localStorage.getItem('isAuthenticated');
    return stored === 'true';
  } catch (_) {
    return false;
  }
};

const initialState = {
  isAuthenticated: getInitialAuth(),
  loading: false,
  message: null,
  error: null,
  config: null,
};

export const connectDatabase = createAsyncThunk(
  'auth/connectDatabase',
  async (formValues, { rejectWithValue }) => {
    try {
      const payload = {
        MSSQL_SERVER: formValues.serverName,
        MSSQL_DB: formValues.databaseName,
        MSSQL_USER: formValues.user,
        MSSQL_PASSWORD: formValues.password,
      };

      const response = await api.post('/db/connect', payload);
      return response.data;
    } catch (error) {
      const data = error?.response?.data;
      if (data) return rejectWithValue(data);
      return rejectWithValue({
        success: false,
        message: 'Request failed',
        error: error.message,
      });
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated(state, action) {
      state.isAuthenticated = Boolean(action.payload);
      try {
        localStorage.setItem('isAuthenticated', String(state.isAuthenticated));
      } catch (_) {}
    },
    login(state) {
      state.isAuthenticated = true;
      try {
        localStorage.setItem('isAuthenticated', 'true');
      } catch (_) {}
    },
    logout(state) {
      state.isAuthenticated = false;
      state.message = null;
      state.error = null;
      state.config = null;
      try {
        localStorage.setItem('isAuthenticated', 'false');
      } catch (_) {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(connectDatabase.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(connectDatabase.fulfilled, (state, action) => {
        state.loading = false;
        const { success, message, config, error } = action.payload || {};
        state.isAuthenticated = Boolean(success);
        state.message = message || null;
        state.error = success ? null : error || null;
        state.config = success ? config || null : null;
        try {
          localStorage.setItem(
            'isAuthenticated',
            String(state.isAuthenticated),
          );
        } catch (_) {}
      })
      .addCase(connectDatabase.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        const payload = action.payload || {};
        state.message = payload.message || null;
        state.error = payload.error || action.error?.message || 'Unknown error';
        state.config = null;
        try {
          localStorage.setItem('isAuthenticated', 'false');
        } catch (_) {}
      });
  },
});

export const { setAuthenticated, login, logout } = authSlice.actions;

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthMessage = (state) => state.auth.message;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;
