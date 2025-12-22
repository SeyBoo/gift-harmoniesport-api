# Mass Import Module Documentation

## Overview

The Mass Import Module provides functionality for bulk importing player card data into the system. It allows users to create sessions containing multiple player cards and track their processing status.

## Features

- **Bulk Processing**: Import multiple player cards in a single session
- **Progress Tracking**: Monitor processing status and completion percentage
- **Status Management**: Individual item status tracking (pending, ready, completed, error)
- **AI Check Integration**: Support for AI validation status tracking
- **Review System**: Mark items as reviewed
- **Error Handling**: Track and manage error messages for failed items

## Data Structure

### Player Card Item

Each item in a mass import session contains the following data:

```typescript
interface PlayerCardData {
  index: number;                    // Order in the batch
  id: string;                       // Unique identifier
  firstName: string;                // Player's first name
  lastName: string;                 // Player's last name
  playerNumber: string;             // Player's number
  playerFace?: string;              // Player's face image URL (optional)
  season: string;                   // Season information
  variant: {                        // Card variant details
    id: string;
    name: string;
  };
  imageUrl: string;                 // Main image URL
  imagePosition: { x: number; y: number };  // Image positioning
  imageScale: number;               // Image scale factor
  imageRotation: number;            // Image rotation in degrees
  cardDesign: number;               // Card design template ID
  textPosition: { x: number; y: number };   // Text positioning
  firstNameSize: number;            // First name font size
  lastNameSize: number;             // Last name font size
  textGap: number;                  // Gap between text elements
  aiCheck?: {                       // AI validation status (optional)
    status: 'pending' | 'checking' | 'passed' | 'warning' | 'failed';
    message?: string;
    score?: number;
  };
  status: 'pending' | 'ready' | 'completed' | 'error';  // Processing status
  reviewed: boolean;                // Review status
}
```

## API Endpoints

### Create Mass Import Session
```http
POST /mass-import
```

**Request Body:**
```json
{
  "sessionName": "Player Cards Batch 1",
  "description": "Import of 2024 season player cards",
  "items": [
    {
      "index": 0,
      "id": "player-001",
      "firstName": "John",
      "lastName": "Doe",
      "playerNumber": "10",
      "season": "2024",
      "variant": {
        "id": "variant-1",
        "name": "Standard"
      },
      "imageUrl": "https://example.com/player1.jpg",
      "imagePosition": { "x": 100, "y": 150 },
      "imageScale": 1.0,
      "imageRotation": 0,
      "cardDesign": 1,
      "textPosition": { "x": 200, "y": 300 },
      "firstNameSize": 24,
      "lastNameSize": 20,
      "textGap": 10,
      "status": "pending",
      "reviewed": false
    }
  ]
}
```

**Response:**
```json
{
  "id": "session-uuid",
  "userId": 123,
  "status": "pending",
  "totalItems": 1,
  "processedItems": 0,
  "progressPercentage": 0,
  "sessionName": "Player Cards Batch 1",
  "description": "Import of 2024 season player cards",
  "massImportItems": [...],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### List All Sessions
```http
GET /mass-import
```

**Response:**
```json
[
  {
    "id": "session-uuid",
    "userId": 123,
    "status": "completed",
    "totalItems": 10,
    "processedItems": 10,
    "progressPercentage": 100,
    "sessionName": "Player Cards Batch 1",
    "massImportItems": [...],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:35:00Z"
  }
]
```

### Get Specific Session
```http
GET /mass-import/:id
```

**Response:**
```json
{
  "id": "session-uuid",
  "userId": 123,
  "status": "in_progress",
  "totalItems": 10,
  "processedItems": 5,
  "progressPercentage": 50,
  "sessionName": "Player Cards Batch 1",
  "massImportItems": [
    {
      "id": "item-uuid",
      "index": 0,
      "firstName": "John",
      "lastName": "Doe",
      "playerNumber": "10",
      "status": "completed",
      "reviewed": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:32:00Z"
}
```

### Update Item
```http
PATCH /mass-import/:sessionId/items/:itemId
```

**Request Body:**
```json
{
  "status": "completed",
  "reviewed": true,
  "aiCheck": {
    "status": "passed",
    "score": 95
  },
  "errorMessage": null
}
```

**Response:**
```json
{
  "id": "item-uuid",
  "index": 0,
  "firstName": "John",
  "lastName": "Doe",
  "status": "completed",
  "reviewed": true,
  "aiCheck": {
    "status": "passed",
    "score": 95
  },
  "updatedAt": "2024-01-15T10:32:00Z"
}
```

### Delete Session
```http
DELETE /mass-import/:id
```

**Response:** 204 No Content

## Status Values

### Session Status
- `pending` - Session created, waiting to start processing
- `in_progress` - Items are being processed
- `completed` - All items have been processed successfully
- `failed` - Session failed due to errors
- `processing` - Session is being prepared
- `uploaded` - Session has been uploaded

### Item Status
- `pending` - Item waiting to be processed
- `ready` - Item is ready for processing
- `completed` - Item has been processed successfully
- `error` - Item failed to process

### AI Check Status
- `pending` - AI check not started
- `checking` - AI check in progress
- `passed` - AI check passed
- `warning` - AI check passed with warnings
- `failed` - AI check failed

## Database Schema

### mass_import_session
- `id` (UUID, Primary Key)
- `user_id` (Integer, Foreign Key to user.id)
- `status` (Enum)
- `total_items` (Integer)
- `processed_items` (Integer)
- `progress_percentage` (Decimal)
- `session_name` (Varchar, nullable)
- `description` (Text, nullable)
- `metadata` (JSON, nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### mass_import_item
- `id` (UUID, Primary Key)
- `mass_import_session_id` (UUID, Foreign Key)
- `index` (Integer)
- `first_name` (Varchar)
- `last_name` (Varchar)
- `player_number` (Varchar)
- `player_face` (Varchar, nullable)
- `season` (Varchar)
- `variant` (JSON)
- `image_url` (Varchar, nullable)
- `image_position` (JSON)
- `image_scale` (Decimal)
- `image_rotation` (Decimal)
- `card_design` (Integer)
- `text_position` (JSON)
- `first_name_size` (Integer)
- `last_name_size` (Integer)
- `text_gap` (Integer)
- `ai_check` (JSON, nullable)
- `status` (Enum)
- `reviewed` (Boolean)
- `error_message` (Text, nullable)
- `metadata` (JSON, nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

## Usage Examples

### Creating a Mass Import Session

```typescript
const sessionData = {
  sessionName: "2024 Season Players",
  description: "Bulk import of player cards for 2024 season",
  items: [
    {
      index: 0,
      id: "player-001",
      firstName: "John",
      lastName: "Doe",
      playerNumber: "10",
      season: "2024",
      variant: { id: "std", name: "Standard" },
      imageUrl: "https://example.com/player1.jpg",
      imagePosition: { x: 100, y: 150 },
      imageScale: 1.0,
      imageRotation: 0,
      cardDesign: 1,
      textPosition: { x: 200, y: 300 },
      firstNameSize: 24,
      lastNameSize: 20,
      textGap: 10,
      status: "pending",
      reviewed: false
    }
  ]
};

const response = await fetch('/mass-import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(sessionData)
});
```

### Updating Item Status

```typescript
const updateData = {
  status: "completed",
  reviewed: true,
  aiCheck: {
    status: "passed",
    score: 95
  }
};

const response = await fetch(`/mass-import/${sessionId}/items/${itemId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(updateData)
});
```

## Error Handling

The module includes comprehensive error handling:

- **Validation Errors**: DTO validation ensures data integrity
- **Not Found Errors**: Proper 404 responses for missing sessions/items
- **Database Errors**: Graceful handling of database operation failures
- **Progress Tracking**: Automatic progress calculation and status updates

## Authentication

All endpoints require JWT authentication. Include the Bearer token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

Consider implementing rate limiting for bulk operations to prevent system overload.

## Best Practices

1. **Batch Size**: Keep batch sizes reasonable (recommended: 100-1000 items per session)
2. **Error Handling**: Always check for errors in responses
3. **Progress Monitoring**: Use the progress percentage to show user feedback
4. **Data Validation**: Validate data before sending to the API
5. **Retry Logic**: Implement retry logic for failed operations
