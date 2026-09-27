# دندنه - Ice Cream Shop Management System

## Overview
A comprehensive management application for دندنه ice cream shop that handles:
- Employee attendance tracking (biometric/password-based)
- Salary and advance (سلف) management
- Inventory management with automatic deductions
- Group chat communication
- Calendar/leave management
- Role-based access control (Employee, Cashier, Manager)

## Tech Stack
- **Frontend:** React.js with Tailwind CSS
- **Backend:** Node.js with Express.js
- **Database:** SQLite (file-based)
- **Real-time:** Socket.IO for chat
- **Authentication:** JWT tokens

## Roles
1. **Employee:** Clock in/out, request leaves, view personal data
2. **Cashier:** Biometric attendance, process orders, chat
3. **Manager:** Full system access, reports, team management

## Installation
```bash
npm install
npm run build
npm start
```

## Vercel deployment
The frontend and backend are deployed as separate Vercel projects from this repository:
- Set the frontend project's Root Directory to `frontend`.
- Set the backend project's Root Directory to `backend`.
- The frontend's Vite build outputs to `frontend/dist`; its Vercel configuration routes API and Socket.IO requests to the backend project.
- The backend uses Turso for persistent cloud data. Do not rely on the serverless `/tmp` SQLite fallback for production data, since it is temporary.

## License
MIT License