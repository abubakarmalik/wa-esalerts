import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/base-url.js';

const initialState = {
  status: 'idle',
  message: null,
  running: false,
  lastUpdateTime: null,
  error: null,
};

export const startSender = createAsyncThunk(
  'activeTask/startSender',
  async (_payload, { rejectWithValue }) => {
    try {
      // Fire-and-forget: trigger the long-running server process but do not await
      // so the thunk can resolve immediately and the UI can continue.
      void api.post(
        '/send-messages',
        {},
        { headers: { Accept: 'text/event-stream' } },
      );
      return { success: true };
    } catch (error) {
      return rejectWithValue({
        message: 'Failed to start sender',
        error: error.message,
      });
    }
  },
);

export const stopSender = createAsyncThunk(
  'activeTask/stopSender',
  async () => {
    await api.post('/stop-sender');
    return { success: true };
  },
);

const taskSlice = createSlice({
  name: 'activeTask',
  initialState,
  reducers: {
    resetTask(state) {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startSender.pending, (state) => {
        state.running = true;
        state.status = 'running';
        state.message = 'Starting sending WhatsApp messages...';
        state.error = null;
        state.lastUpdateTime = new Date().toISOString();
      })
      .addCase(startSender.fulfilled, (state) => {
        // Keep running; server process continues in the background
        state.running = true;
        state.status = 'running';
        state.lastUpdateTime = new Date().toISOString();
      })
      .addCase(startSender.rejected, (state, action) => {
        state.running = false;
        state.status = 'error';
        const payload = action.payload || {};
        state.message = payload.message || 'Failed to start sender';
        state.error = payload.error || action.error?.message || 'Unknown error';
        state.lastUpdateTime = new Date().toISOString();
      })
      .addCase(stopSender.fulfilled, (state) => {
        state.running = false;
        state.status = 'idle';
        state.message = null;
        state.lastUpdateTime = new Date().toISOString();
      })
      .addCase(stopSender.rejected, (state, action) => {
        state.running = false;
        state.status = 'error';
        state.message = 'Failed to stop sender';
        state.error = action.error?.message || 'Unknown error';
        state.lastUpdateTime = new Date().toISOString();
      });
  },
});

export const { resetTask } = taskSlice.actions;

export const selectActiveTask = (state) => state.activeTask;
export const selectIsRunning = (state) => state.activeTask.running;

export default taskSlice.reducer;
