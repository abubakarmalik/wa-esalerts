import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { sendBroadcast } from '../features/broadcast/broadcastSlice.js';

const FileIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-700">
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      fill="currentColor"
      opacity=".7"
    />
    <path d="M14 2v6h6" fill="currentColor" opacity=".7" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-700">
    <path
      d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
      fill="currentColor"
      opacity=".7"
    />
  </svg>
);

const SendForm = () => {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.broadcast || { status: 'idle' });
  const isSubmitting = status === 'loading';

  const [messageType, setMessageType] = useState('text');
  const [textMessage, setTextMessage] = useState('');
  const [caption, setCaption] = useState('');
  const [filePath, setFilePath] = useState('');

  const messageTypes = [
    { value: 'text', label: 'Text Message', icon: '💬' },
    { value: 'image', label: 'Image', icon: '🖼️' },
    { value: 'pdf', label: 'PDF Document', icon: '📄' },
    { value: 'image-caption', label: 'Image with Caption', icon: '🖼️💬' },
    { value: 'pdf-caption', label: 'PDF with Caption', icon: '📄💬' },
    // { value: 'video', label: 'Video', icon: '🎥' },
    // { value: 'video-caption', label: 'Video with Caption', icon: '🎥💬' },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    // Validation (same feel as before)
    if (messageType === 'text' && !textMessage.trim()) {
      toast.error('Please enter a text message');
      return;
    }
    if (messageType.includes('caption') && !caption.trim()) {
      toast.error('Please enter a caption');
      return;
    }
    // For media types, now require a server path string instead of file upload
    if (
      (messageType.includes('image') ||
        messageType.includes('pdf') ||
        messageType.includes('video')) &&
      !filePath.trim()
    ) {
      toast.error('Please provide a server file path');
      return;
    }

    try {
      await dispatch(
        sendBroadcast({
          messageType,
          textMessage,
          caption,
          filePath: filePath.trim(), // JSON path for backend to read from disk
        }),
      ).unwrap();

      console.log('file path: ', filePath);
      console.log('caption : ', caption);

      // Reset form
      setTextMessage('');
      setCaption('');
      setFilePath('');
      setMessageType('text');
    } catch {
      // Errors are toasted in the slice
    }
  };

  const resetForm = () => {
    setTextMessage('');
    setCaption('');
    setFilePath('');
    setMessageType('text');
  };

  const getIconForType = (type) => {
    if (type.includes('image')) return <ImageIcon />;
    if (type.includes('pdf') || type.includes('video')) return <FileIcon />;
    return <span className="text-2xl">💬</span>;
  };

  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-r from-gray-500 via-sky-300 to-gray-800 shadow-[0_10px_40px_-15px_rgba(99,102,241,0.5)]">
      <div className="rounded-2xl bg-white/90 backdrop-blur-sm">
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-50 ring-1 ring-gray-100">
                {getIconForType(messageType)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                  Broadcast Message
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Send different types of messages to all contacts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                <span className="mr-1.5 block h-2 w-2 rounded-full bg-green-500" />
                Ready to Broadcast
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left column */}
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  {/* Whatsapp Option */}
                  <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white p-5 ring-1 ring-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Whatsapp Option
                    </label>
                    <select
                      value={messageType}
                      onChange={(e) => setMessageType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    >
                      {messageTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message / Caption */}
                  {(messageType === 'text' ||
                    messageType.includes('caption')) && (
                    <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white p-5 ring-1 ring-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {messageType === 'text' ? 'Message' : 'Caption'}
                      </label>
                      <textarea
                        value={messageType === 'text' ? textMessage : caption}
                        onChange={(e) =>
                          messageType === 'text'
                            ? setTextMessage(e.target.value)
                            : setCaption(e.target.value)
                        }
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        placeholder={
                          messageType === 'text'
                            ? 'Enter your message here...'
                            : 'Write a caption for the media...'
                        }
                      />
                    </div>
                  )}

                  {/* File Path (Image/PDF/Video) – styled like your uploader card */}
                  {(messageType.includes('image') ||
                    messageType.includes('pdf') ||
                    messageType.includes('video')) && (
                    <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white p-5 ring-1 ring-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {messageType.includes('image')
                          ? 'Image Path'
                          : messageType.includes('pdf')
                          ? 'PDF Path'
                          : 'Video Path'}
                      </label>

                      {/* Keep the dashed box look */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                        <div className="space-y-3 text-center">
                          <div className="text-4xl">📁</div>
                          <p className="text-sm text-gray-600">
                            Provide the <strong>server-side file path</strong>{' '}
                            the backend can access.
                          </p>
                          <p className="text-xs text-gray-500">
                            Example:{' '}
                            <code className="font-mono">
                              C:\uploads\promo.jpg
                            </code>{' '}
                            or{' '}
                            <code className="font-mono">
                              /var/data/docs/brochure.pdf
                            </code>
                          </p>
                        </div>

                        <div className="mt-5">
                          <input
                            type="text"
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            placeholder={
                              messageType.includes('image')
                                ? 'e.g., C:\\uploads\\banner.jpg'
                                : messageType.includes('pdf')
                                ? 'e.g., /var/data/brochure.pdf'
                                : 'e.g., /mnt/media/clip.mp4'
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                          />
                        </div>

                        <p className="mt-2 text-xs text-gray-500">
                          This will send JSON with{' '}
                          <code className="font-mono">
                            {'{ type, caption?, filePath }'}
                          </code>
                          .
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Panel */}
              <div className="flex flex-col justify-between rounded-xl ring-1 ring-gray-200 p-5 bg-white/80">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Actions</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Send your message to all contacts.
                  </p>
                </div>
                <div className="mt-4 flex flex-col space-y-3">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-gray-900 to-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md hover:brightness-110 focus:outline-none disabled:opacity-50 transition"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Sending.
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                        Broadcast Message
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition"
                    onClick={resetForm}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                    </svg>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SendForm;
