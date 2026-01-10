# Qline Backend

## 🚀 Features
- **Authentication**:
  - **Local Auth**: Email and password login with bcrypt hashing.
  - **Social Auth**: Google OAuth 2.0 integration.
  - **JWT**: Secure session management using JSON Web Tokens.
- **Configuration**: Centralized environment configuration using `@nestjs/config`.
- **Validation**: Request data validation using `class-validator`.

##  Tech Stack
- **Framework**: Built with [NestJS](https://nestjs.com/) for scalable server-side applications.
- **Database**: [PostgreSQL](https://www.postgresql.org/) integration using [TypeORM](https://typeorm.io/).
- **Validation**: Request data validation using `class-validator`.

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
   Create a `.env` file in the root directory and add the following variables:

   ```env
   # Server
   PORT=8000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000

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
   GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback
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
| `GET` | `/auth/google` | Initiate Google OAuth login | No |
| `GET` | `/auth/google/callback` | Google OAuth callback URL | No |
| `GET` | `/auth/profile` | Get current user profile | **Yes** (Bearer Token) |
| `GET` | `/auth/me` | Alias for profile | **Yes** (Bearer Token) |

## 📂 Project Structure

```
src/
├── auth/           # Authentication module (Strategies, Guards, Services)
├── database/       # Database configuration module
├── entities/       # TypeORM entities (User, etc.)
├── app.module.ts   # Main application module
└── main.ts         # Application entry point
```