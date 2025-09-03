import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/base-url';
import { toast } from 'react-toastify';

/**
 * Normalizes SendForm fields -> server body:
 * - messageType: 'text' | 'image' | 'image-caption' | 'pdf' | 'pdf-caption'
 * - textMessage, caption, selectedFile
 *
 * Server expects:
 *  - JSON for text: { type:'text', text }
 *  - For media we try MULTIPART first (file upload). If no file provided,
 *    we fallback to JSON (assumes server can resolve local path by `filePath`).
 */
function buildRequest({
  messageType,
  textMessage,
  caption,
  selectedFile,
  filePath,
}) {
  const base = { caption: caption?.trim() || '' };

  if (messageType === 'text') {
    return {
      useFormData: false,
      body: { type: 'text', text: (textMessage || '').trim() },
    };
  }

  // Map messageType -> type
  const isImage = messageType.includes('image');
  const isPdf = messageType.includes('pdf');
  const type = isImage ? 'image' : isPdf ? 'pdf' : 'text';

  // Prefer multipart when a File object is present
  if (selectedFile) {
    const fd = new FormData();
    fd.append('type', type);
    if (base.caption) fd.append('caption', base.caption);
    fd.append('file', selectedFile); // server must accept multipart
    return { useFormData: true, body: fd };
  }

  // Fallback JSON (if your backend expects a local server path instead of upload)
  return {
    useFormData: false,
    body: {
      type,
      caption: base.caption,
      filePath: filePath || '', // server must resolve this path
    },
  };
}

export const sendBroadcast = createAsyncThunk(
  'broadcast/sendBroadcast',
  async (payload, { rejectWithValue }) => {
    try {
      const { useFormData, body } = buildRequest(payload);
      const headers = useFormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

      const res = await api.post('/broadcast', body, { headers });
      return res.data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send broadcast';
      return rejectWithValue(msg);
    }
  },
);

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  lastResult: null,
  error: null,
};

const slice = createSlice({
  name: 'broadcast',
  initialState,
  reducers: {
    clearBroadcastState: (state) => {
      state.status = 'idle';
      state.lastResult = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendBroadcast.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(sendBroadcast.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.lastResult = action.payload;
        toast.success(
          action.payload?.message ||
            `Broadcast complete (sent: ${
              action.payload?.sent ?? '-'
            }, failed: ${action.payload?.failed ?? '-'})`,
        );
      })
      .addCase(sendBroadcast.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Broadcast failed';
        toast.error(state.error);
      });
  },
});

export const { clearBroadcastState } = slice.actions;
export default slice.reducer;
