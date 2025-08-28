# WhatsApp Automation API

A Node.js API for automating WhatsApp message sending using the `whatsapp-web.js` library and SQL Server database integration.

## Features

- 🔗 Database connection management (SQL Server)
- 📱 WhatsApp Web automation
- 📊 Fetch pending SMS records from database
- 📨 Send WhatsApp messages automatically
- ⏱️ Configurable delays between messages (15-30 seconds)
- 🔄 Automatic message acknowledgment tracking
- 📈 Message status tracking and updates

## Prerequisites

- Node.js (v14 or higher)
- SQL Server database with `ES_SMS` table
- Google Chrome browser installed
- WhatsApp account for QR code scanning

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the server directory:

```env
# Database Configuration
MSSQL_SERVER=your_server_name
MSSQL_DB=your_database_name
MSSQL_USER=your_username
MSSQL_PASSWORD=your_password
MSSQL_PORT=1433
MSSQL_ENCRYPT=true
MSSQL_TRUST_CERT=true
```

## Database Schema

The application expects an `ES_SMS` table with the following structure:

```sql
CREATE TABLE ES_SMS (
    SystemCode VARCHAR(50),
    CampusCode VARCHAR(50),
    CreationDate DATETIME,
    SrNo INT,
    SMSEventName VARCHAR(100),
    SMSTo VARCHAR(15),
    SMSBody TEXT,
    SendStatus INT DEFAULT 0
);
```

## API Endpoints

### 1. Establish Database Connection

```http
POST /database-connection
Content-Type: application/json

{
    "MSSQL_SERVER": "your_server",
    "MSSQL_DB": "your_database",
    "MSSQL_USER": "your_username",
    "MSSQL_PASSWORD": "your_password",
    "MSSQL_PORT": 1433,
    "MSSQL_ENCRYPT": true,
    "MSSQL_TRUST_CERT": true
}
```

### 2. Get Pending Records

```http
GET /getrecords
```

Returns all records where `SendStatus = 0`.

### 3. Send WhatsApp Messages (Real-time Status)

```http
POST /send-messages
```

**Real-time Status Updates:** This endpoint provides live status updates using Server-Sent Events (SSE).

**Status Types:**

- `initializing` - Starting the automation
- `connecting` - Initializing WhatsApp client
- `connected` - WhatsApp client ready
- `fetching` - Fetching next pending message
- `sending` - Sending message to recipient
- `sent` - Message sent successfully
- `waiting` - Waiting before next message
- `error` - Error occurred while sending
- `completed` - All messages processed
- `finished` - Process completed
- `cleanup` - Cleaning up resources

**Response Format:**

```
data: {"timestamp":"2024-01-01T12:00:00.000Z","status":"sending","message":"Sending message to 1234567890","currentRecord":{"SrNo":1,"SMSTo":"1234567890","SMSEventName":"Test Event"},"processedCount":5,"errorCount":0}

data: {"timestamp":"2024-01-01T12:00:01.000Z","status":"sent","message":"Message sent successfully to 1234567890","processedCount":6,"errorCount":0}
```

**Features:**

- Real-time progress monitoring
- Live statistics (processed/error counts)
- Current record information
- Wait time display
- Error tracking

### 4. Close Database Connection

```http
POST /close-database-connection
```

## Usage Flow

1. **Start the server:**

```bash
npm run dev
```

2. **Establish database connection:**

```bash
curl -X POST http://localhost:3000/database-connection \
  -H "Content-Type: application/json" \
  -d '{
    "MSSQL_SERVER": "your_server",
    "MSSQL_DB": "your_database",
    "MSSQL_USER": "your_username",
    "MSSQL_PASSWORD": "your_password"
  }'
```

3. **Check pending records:**

```bash
curl http://localhost:3000/getrecords
```

4. **Send WhatsApp messages:**

```bash
curl -X POST http://localhost:3000/send-messages
```

5. **Close connection:**

```bash
curl -X POST http://localhost:3000/close-database-connection
```

## WhatsApp Setup

1. **First Run:** When you call `/send-messages` for the first time:

   - A Chrome browser window will open
   - Scan the QR code with your WhatsApp mobile app
   - Go to WhatsApp → Settings → Linked Devices
   - Scan the QR code displayed in the browser

2. **Subsequent Runs:** The authentication will be saved and reused automatically.

## Configuration

### WhatsApp Client Settings

- **Headless Mode:** Set to `false` to see the browser window (useful for debugging)
- **Chrome Path:** Automatically detected on Windows
- **Authentication:** Uses local file storage for session persistence

### Message Processing

- **Delay Range:** 15-30 seconds between messages (randomized)
- **ACK Timeout:** 20 seconds for message acknowledgment
- **Error Handling:** 5-second backoff on errors

## Error Handling

The API includes comprehensive error handling:

- Database connection failures
- WhatsApp client initialization errors
- Message sending failures
- Network timeouts
- Invalid phone number formats

## React Integration

### Real-time Status Monitoring

The API provides real-time status updates that can be consumed by React applications. See `react-example.jsx` for a complete implementation.

**Key Features:**

- Live status updates using Server-Sent Events (SSE)
- Real-time progress tracking
- Error handling and display
- Statistics monitoring
- Current record information

**React Component Example:**

```jsx
const startWhatsAppProcessing = async () => {
  const response = await fetch('/send-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        // Update your React state with data.status, data.message, etc.
        setStatus(data.status);
        setMessage(data.message);
      }
    }
  }
};
```

## Testing

Run the test script to verify functionality:

```bash
node test-whatsapp.js
```

## Security Notes

- Store database credentials securely
- Use environment variables for sensitive data
- WhatsApp session data is stored locally
- Consider implementing rate limiting for production use

## Troubleshooting

### Common Issues

1. **Chrome not found:**

   - Ensure Google Chrome is installed
   - Check if Chrome path is correctly detected

2. **QR code not appearing:**

   - Check internet connection
   - Ensure WhatsApp Web is accessible

3. **Database connection failed:**

   - Verify SQL Server credentials
   - Check firewall settings
   - Ensure SQL Server is running

4. **Messages not sending:**
   - Verify phone numbers are in international format
   - Check if WhatsApp is properly authenticated
   - Review error logs for specific issues

## Development

### Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── db.js          # Database connection management
│   │   └── helper.js      # WhatsApp and utility functions
│   ├── controller/
│   │   └── index.js       # API controllers
│   ├── routes/
│   │   └── index.js       # API routes
│   └── server.js          # Express server
├── package.json
├── test-whatsapp.js       # Test script
└── README.md
```

### Adding New Features

1. **New Helper Functions:** Add to `src/config/helper.js`
2. **New Controllers:** Add to `src/controller/index.js`
3. **New Routes:** Add to `src/routes/index.js`

## License

ISC License
