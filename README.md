# Qline Backend

## 🚀 Features
- **Secure Authentication**:
  - **HttpOnly Cookies**: All authentication tokens (JWT) are stored securely in HttpOnly, SameSite=Lax cookies to prevent XSS attacks.
  - **Local Auth**: Email and password login with bcrypt hashing.
  - **Password Reset**: Secure forgot password flow with email-based token verification.
- **Social Auth**: Google OAuth 2.0 integration with secure callback handling. Supports **Dynamic Redirects** for mobile deep linking (e.g., `appfrontend://`).
  - **Session Management**: Dual-strategy JWT extraction (Cookie for Web, Bearer Header for Mobile).
- **Email Service**: Nodemailer integration for transactional emails (password reset, etc.).
- **Security**:
  - **CORS**: Configured to safely accept credentials from the frontend, dynamically reflecting the origin.
  - **Validation**: Request data validation using `class-validator`.
  - **Token Security**: Password reset tokens are hashed with bcrypt and expire after 1 hour.
- **Configuration**: Centralized environment configuration using `@nestjs/config`.

##  Tech Stack
- **Framework**: [NestJS](https://nestjs.com/) for scalable server-side applications.
- **Database**: [PostgreSQL](https://www.postgresql.org/) integration using [TypeORM](https://typeorm.io/).
- **Middleware**: `cookie-parser` for handling secure cookies.

## 🛠️ Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [PostgreSQL](https://www.postgresql.org/)
- [npm](https://www.npmjs.com/)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory. To support authentication on physical mobile devices, we use `nip.io` domains (wildcard DNS) instead of `localhost`.

   **Example `.env`:**
   ```env
   # Server
   PORT=8000
   NODE_ENV=development
   # Replace 192.168.x.x with your local LAN IP
   FRONTEND_URL=http://192.168.x.x.nip.io:3000

   # Database (PostgreSQL)
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_NAME=qline

   # JWT Authentication
   JWT_SECRET=your_super_secret_jwt_key
   JWT_EXPIRES_IN_SECONDS=604800 # 7 days in seconds

   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   # Replace with your LAN IP. MUST be added to Google Cloud Console Authorized Redirect URIs
   GOOGLE_CALLBACK_URL=http://192.168.x.x.nip.io:8000/auth/google/callback

   # Email Configuration (for password reset)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-specific-password
   EMAIL_FROM=noreply@qline.com
   ```

## 🏃‍♂️ Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start:prod
```

## 🔌 API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new user | No |
| `POST` | `/auth/login` | Login with email and password | No |
| `POST` | `/auth/logout` | Logout (Clear secure cookies) | No |
| `POST` | `/auth/forgot-password` | Request password reset email | No |
| `POST` | `/auth/reset-password` | Reset password with token | No |
| `GET` | `/auth/google` | Initiate Google OAuth login | No |
| `GET` | `/auth/google/callback` | Google OAuth callback URL | No |
| `GET` | `/auth/profile` | Get current user profile | **Yes** (Cookie/Bearer) |
| `GET` | `/auth/me` | Alias for profile | **Yes** (Cookie/Bearer) |

## 📂 Project Structure

```
src/
├── auth/           # Authentication module (Strategies, Guards, Services)
├── email/          # Email service module (Nodemailer)
├── database/       # Database configuration module
├── entities/       # TypeORM entities (User, etc.)
├── app.module.ts   # Main application module
└── main.ts         # Application entry point
```