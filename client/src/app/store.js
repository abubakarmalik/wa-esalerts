import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice.js';
import activeTaskReducer from '../features/activetask/taskSlice.js';
import broadcastReducer from '../features/broadcast/broadcastSlice.js';

const store = configureStore({
  reducer: {
    auth: authReducer,
    activeTask: activeTaskReducer,
    broadcast: broadcastReducer,
  },
});

export default store;
