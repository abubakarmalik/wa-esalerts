import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/base-url.js';
import ProgressBar from './progressBar';

const StatusBadge = ({ running }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      running
        ? 'bg-blue-100 text-blue-800 border border-blue-200'
        : 'bg-gray-100 text-gray-800 border border-gray-200'
    }`}
  >
    <span
      className={`mr-1.5 block h-2 w-2 rounded-full ${
        running ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
      }`}
    />
    {running ? 'Running' : 'Idle'}
  </span>
);

const STORAGE_KEYS = {
  running: 'wa_sender_running',
  message: 'wa_sender_message',
  time: 'wa_sender_last_update',
};

const Sparkle = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-500">
    <path
      d="M12 2l1.8 4.6L18 8.4l-4.2 1.1L12 14l-1.8-4.5L6 8.4l4.2-1.8L12 2z"
      fill="currentColor"
      opacity=".7"
    />
  </svg>
);

const ActiveTask = () => {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    'Ready to start sending WhatsApp messages.',
  );
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const abortRef = useRef(null);

  // Restore UI state on mount
  useEffect(() => {
    try {
      const savedRunning = localStorage.getItem(STORAGE_KEYS.running);
      const savedMsg = localStorage.getItem(STORAGE_KEYS.message);
      const savedTime = localStorage.getItem(STORAGE_KEYS.time);
      if (savedRunning === 'true') {
        setRunning(true);
        setMessage(savedMsg || 'Process is running in background.');
      }
      if (savedTime) setLastUpdateTime(savedTime);
    } catch {}
  }, []);

  // Persist on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.running, String(running));
      if (message != null) localStorage.setItem(STORAGE_KEYS.message, message);
      if (lastUpdateTime != null)
        localStorage.setItem(STORAGE_KEYS.time, lastUpdateTime);
    } catch {}
  }, [running, message, lastUpdateTime]);

  useEffect(() => {
    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, []);

  const handleStart = async () => {
    if (running || isBusy) return;
    setIsBusy(true);
    setRunning(true);
    const startedAt = new Date().toISOString();
    setMessage('Starting sending WhatsApp messages...');
    setLastUpdateTime(startedAt);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      void api
        .post(
          '/send-messages',
          {},
          {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          },
        )
        .catch((err) => {
          if (!controller.signal.aborted) {
            toast.error(
              err?.response?.data?.message || err.message || 'Failed to start',
            );
            setRunning(false);
            setMessage('Ready to start sending WhatsApp messages.');
            setLastUpdateTime(new Date().toISOString());
          }
        });

      toast.success('Process started');
    } catch (error) {
      toast.error(error?.message || 'Failed to start');
      setRunning(false);
      setMessage('Ready to start sending WhatsApp messages.');
      setLastUpdateTime(new Date().toISOString());
    } finally {
      setIsBusy(false);
    }
  };

  const handleStop = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      abortRef.current?.abort();
    } catch {}
    try {
      await api.post('/stop-sender');
      toast.info('Process stopped');
    } catch (error) {
      toast.error(
        error?.response?.data?.message || error.message || 'Failed to stop',
      );
    } finally {
      setRunning(false);
      setMessage('Ready to start sending WhatsApp messages.');
      setLastUpdateTime(new Date().toISOString());
      setIsBusy(false);
    }
  };

  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-r from-gray-500 via-sky-300 to-gray-800 shadow-[0_10px_40px_-15px_rgba(99,102,241,0.5)]">
      <div className="rounded-2xl bg-white/90 backdrop-blur-sm">
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
                <Sparkle />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                  WhatsApp Auto Sender
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Control the background process. Click Start to initiate
                  sending; click Stop to terminate.
                </p>
              </div>
            </div>
            <StatusBadge running={running} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white p-5 ring-1 ring-gray-200">
                <p className="text-gray-800 text-sm whitespace-pre-wrap break-words">
                  {message}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  Last update: {lastUpdateTime || '—'}
                </div>
              </div>

              {running && (
                <div className="mt-6">
                  <ProgressBar label="Working in background" />
                  <div className="mt-2 text-xs text-gray-500">
                    Process is running in background. You can navigate
                    elsewhere; it will continue.
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between rounded-xl ring-1 ring-gray-200 p-5 bg-white/80">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Actions</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Only one process can run at a time.
                </p>
              </div>
              <div className="mt-4 flex flex-col space-y-3">
                {!running ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-gray-900 to-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md hover:brightness-110 focus:outline-none disabled:opacity-50 transition"
                    onClick={handleStart}
                    disabled={isBusy}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Start Process
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md focus:outline-none disabled:opacity-50 transition"
                    onClick={handleStop}
                    disabled={isBusy}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6 6h12v12H6z" />
                    </svg>
                    Stop Process
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition"
                  onClick={() => window.location.reload()}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 11-9.9-1h-2A7 7 0 1012 6z" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveTask;
