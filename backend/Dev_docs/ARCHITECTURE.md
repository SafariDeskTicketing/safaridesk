# SafariDesk Backend Architecture

**Project:** SafariDesk - Multi-Tenant Ticketing System  
**Framework:** Django 5.0 + Django REST Framework  
**Date:** December 16, 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Application Structure](#application-structure)
5. [Core Modules](#core-modules)
6. [Data Models](#data-models)
7. [API Architecture](#api-architecture)
8. [Management Commands](#management-commands)
9. [Background Tasks & Workers](#background-tasks--workers)
10. [Real-Time Features](#real-time-features)
11. [Security & Authentication](#security--authentication)
12. [Integration Points](#integration-points)
13. [Deployment Architecture](#deployment-architecture)
14. [Scalability & Performance](#scalability--performance)

---

## Executive Summary

SafariDesk is a comprehensive, multi-tenant customer support platform built with Django. It provides ticketing, SLA management, knowledge base, AI chatbot, asset management, and email integration capabilities. The system supports custom domains per business and includes sophisticated real-time notification features.

### Key Capabilities:
- **Multi-Tenancy**: Business-isolated data with custom domain support
- **Ticketing System**: Full-featured ticket management with SLA tracking
- **Knowledge Base**: AI-powered with pgvector embeddings
- **Real-time Communication**: WebSocket support via Django Channels
- **Email Integration**: OAuth2 (Google/Microsoft) and IMAP/SMTP
- **Background Processing**: Celery-based task queue
- **AI Features**: Gemini-powered chatbot and semantic search

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Web App    │  │ Mobile Apps  │  │ Email Client │              │
│  │  (React/Vue) │  │   (iOS/Android)│ │ (Mailgun)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼────────────────────┘
          │                  │                  │
          │ REST API         │ REST API         │ Webhooks
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Custom Domain Middleware                       │    │
│  │         (Routes requests based on domain/subdomain)         │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │         JWT Authentication + 2FA (django-otp)              │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER (Django)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Users     │  │    Tenant    │  │    Shared    │              │
│  │   Module     │  │   Module     │  │   Module     │              │
│  │              │  │              │  │              │              │
│  │ • Auth       │  │ • Tickets    │  │ • Base Models│              │
│  │ • Business   │  │ • SLA        │  │ • Workers    │              │
│  │ • Customers  │  │ • Departments│  │ • Tasks      │              │
│  │ • Domains    │  │ • KB         │  │ • Services   │              │
│  └──────────────┘  │ • Chatbot    │  │ • Middleware │              │
│                    │ • Assets     │  └──────────────┘              │
│                    │ • Contacts   │                                 │
│                    │ • Tasks      │                                 │
│                    └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Email     │  │      AI      │  │     SLA      │              │
│  │   Service    │  │   Service    │  │   Service    │              │
│  │              │  │              │  │              │              │
│  │ • IMAP/SMTP  │  │ • Gemini API │  │ • Monitoring │              │
│  │ • OAuth2     │  │ • Embeddings │  │ • Escalation │              │
│  │ • Mailgun    │  │ • Intent     │  │ • Violations │              │
│  └──────────────┘  │ • KB Search  │  └──────────────┘              │
│                    └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ASYNC PROCESSING LAYER                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Celery Workers                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │    Email     │  │     SLA      │  │   Domain     │     │    │
│  │  │  Processing  │  │  Monitoring  │  │ Verification │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   Celery Beat Scheduler                     │    │
│  │        (Periodic tasks: SLA checks, email sync)             │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   REAL-TIME LAYER (WebSocket)                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Django Channels (ASGI) + Daphne                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │Notifications │  │     Chat     │  │    Setup     │     │    │
│  │  │   Consumer   │  │   Consumer   │  │   Consumer   │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│  ┌────────────────────┐  ┌────────────────────┐                    │
│  │    PostgreSQL      │  │       Redis        │                    │
│  │                    │  │                    │                    │
│  │ • Business Data    │  │ • Sessions         │                    │
│  │ • User Data        │  │ • Cache            │                    │
│  │ • Tickets          │  │ • Celery Queue     │                    │
│  │ • SLA              │  │ • Channels Layer   │                    │
│  │ • KB + Vectors     │  │ • WebSocket State  │                    │
│  │   (pgvector)       │  └────────────────────┘                    │
│  └────────────────────┘                                             │
│  ┌────────────────────┐                                             │
│  │   File Storage     │                                             │
│  │  (/mnt/safaridesk) │                                             │
│  │                    │                                             │
│  │ • Attachments      │                                             │
│  │ • KB Files         │                                             │
│  │ • Avatars          │                                             │
│  └────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend Framework
- **Django 5.0**: Core web framework
- **Django REST Framework**: API development
- **Django Channels**: WebSocket/ASGI support
- **Daphne**: ASGI server for WebSocket connections

### Database & Storage
- **PostgreSQL**: Primary database with pgvector extension
- **Redis**: Caching, Celery broker, Channels layer
- **File System**: Media storage at `/mnt/safaridesk`

### Authentication & Security
- **django-rest-framework-simplejwt**: JWT tokens (1-day expiry)
- **django-otp**: Two-factor authentication
- **OAuth2**: Google & Microsoft email integration
- **Fernet Encryption**: Mailbox credential encryption

### Task Queue & Scheduling
- **Celery**: Distributed task queue
- **Celery Beat**: Periodic task scheduler
- **django-celery-beat**: Database-backed periodic tasks

### AI & ML
- **Google Gemini API**: AI chatbot & intent analysis
- **pgvector**: Vector embeddings for semantic search
- **OpenAI-compatible embeddings**: Knowledge base search

### External Services
- **Mailgun**: Email routing and webhooks
- **Google OAuth**: Gmail integration
- **Microsoft OAuth**: Outlook/Exchange integration

### Development & Deployment
- **Docker & Docker Compose**: Containerization
- **Gunicorn**: WSGI server (3 workers)
- **Supervisor**: Process management
- **CORS Headers**: Cross-origin resource sharing

---

## Application Structure

### Module Organization

```
SafariDesk-Back/
├── RNSafarideskBack/          # Project configuration
│   ├── settings/
│   │   ├── base.py            # Shared settings
│   │   ├── dev.py             # Development settings
│   │   └── prod.py            # Production settings
│   ├── asgi.py                # ASGI application (WebSockets)
│   ├── wsgi.py                # WSGI application (HTTP)
│   ├── celery.py              # Celery configuration
│   └── urls.py                # Root URL configuration
│
├── users/                     # User & Business Management
│   ├── models/
│   │   ├── UserModel.py       # Users & Customers
│   │   ├── BusinessModel.py   # Business & CustomDomains
│   │   ├── ActivityModel.py   # Activity tracking
│   │   └── SuspiciousActivity.py
│   ├── views/
│   │   ├── AuthView.py        # Authentication endpoints
│   │   ├── UserView.py        # User CRUD operations
│   │   ├── BusinessView.py    # Business management
│   │   └── CustomDomainView.py# Custom domain management
│   ├── routes/                # URL routing
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── business.py
│   │   └── custom_domains.py
│   ├── management/commands/
│   │   └── verify_domains.py  # Domain verification CLI
│   └── serializers/           # API serializers
│
├── tenant/                    # Core Business Logic
│   ├── models/
│   │   ├── TicketModel.py     # Ticket & Categories
│   │   ├── SlaXModel.py       # SLA & Targets
│   │   ├── DepartmentModel.py # Departments & Emails
│   │   ├── KnowledgeBase.py   # KB Articles & Categories
│   │   ├── ChatbotModel.py    # Chatbot configuration
│   │   ├── TaskModel.py       # Task management
│   │   ├── AssetModel.py      # Asset tracking
│   │   ├── ContactModel.py    # Contact management
│   │   ├── SettingModel.py    # Business settings
│   │   ├── MailIntegrationModel.py # Email integrations
│   │   └── Notification.py    # Notification system
│   ├── views/
│   │   ├── TicketView.py      # Ticket endpoints
│   │   ├── SlaXView.py        # SLA management
│   │   ├── DepartmentViewSet.py
│   │   ├── KnowledgeBaseView.py
│   │   ├── ChatbotView.py
│   │   ├── TaskView.py
│   │   ├── AssetViews.py
│   │   ├── ContactView.py
│   │   ├── SettingView.py
│   │   ├── NotificationView.py
│   │   ├── MailIntegrationView.py
│   │   ├── MailgunWebhookView.py
│   │   ├── PublicView.py      # Public-facing APIs
│   │   └── DashboardView.py
│   ├── routes/                # URL routing
│   ├── services/
│   │   ├── ai/
│   │   │   ├── gemini_client.py
│   │   │   ├── embedding_service.py
│   │   │   ├── kb_search.py
│   │   │   ├── intent_analyzer.py
│   │   │   ├── ticket_extractor.py
│   │   │   ├── conversation_state.py
│   │   │   ├── context_builder.py
│   │   │   ├── tools.py
│   │   │   └── agentic_settings.py
│   │   ├── tickets/           # Ticket services
│   │   └── contact_linker.py  # Contact linking
│   ├── consumers/
│   │   ├── ChatConsumer.py    # Chat WebSocket
│   │   └── notification_consumer.py
│   ├── management/commands/
│   │   ├── add_default_departments_and_categories.py
│   │   └── generate_kb_embeddings.py
│   └── serializers/
│
├── shared/                    # Shared Components
│   ├── models/
│   │   ├── BaseModel.py       # BaseEntity (business, status, timestamps)
│   │   └── BaseUser.py        # Base user model
│   ├── middleware/
│   │   ├── CustomDomainMiddleware.py
│   │   └── channels_jwt_auth_middleware.py
│   ├── workers/               # Celery workers
│   │   ├── Email.py           # Email processing
│   │   ├── Sla.py             # SLA monitoring
│   │   ├── Task.py            # Task notifications
│   │   ├── Ticket.py          # Ticket notifications
│   │   └── Request.py
│   ├── tasks/
│   │   └── domain_tasks.py    # Domain verification tasks
│   ├── services/
│   │   └── notification_preferences.py
│   ├── management/commands/
│   │   ├── safari.py          # Core setup
│   │   ├── datasync.py        # Data synchronization
│   │   ├── sla.py             # SLA monitoring CLI
│   │   ├── emails.py          # Email processing CLI
│   │   ├── install_pgvector.py
│   │   └── update_imap_settings.py
│   └── tasks.py               # Shared Celery tasks
│
├── util/                      # Utilities
│   ├── Mailer.py              # Email sending
│   ├── EmailTicketService.py  # Email-to-ticket conversion
│   ├── DomainVerificationService.py
│   ├── SlaUtil.py             # SLA calculations
│   ├── Seeder.py              # Database seeding
│   ├── Helper.py              # Helper functions
│   ├── Constants.py           # Application constants
│   ├── ErrorResponse.py       # Error handling
│   ├── Holidays.py            # Holiday management
│   ├── BusinessSetup.py
│   ├── mail/                  # Mail utilities
│   ├── email/                 # Email parsing
│   └── security/              # Security utilities
│
├── templates/                 # Email templates
│   ├── assigned-ticket.html
│   ├── comment-added.html
│   ├── customer-new-ticket.html
│   ├── mention-notification.html
│   ├── new-business.html
│   ├── new-ticket.html
│   ├── otp.html
│   └── password-reset.html
│
├── media/                     # User uploads
│   ├── files/
│   └── kb/
│
├── manage.py                  # Django management
├── compose.yml                # Docker Compose
├── Dockerfile                 # Production Docker
├── Dockerfile.dev             # Development Docker
├── requirements.txt           # Python dependencies
└── Procfile                   # Heroku deployment
```

---

## Core Modules

### 1. **Users Module** (`users/`)
**Purpose**: Authentication, user management, business management, and custom domain handling.

**Key Components**:
- **Models**:
  - `Users`: Business users (admins, agents)
  - `Customer`: External customers
  - `Business`: Multi-tenant business entities
  - `CustomDomains`: Custom domain mapping
  - `ActivityModel`: User activity tracking
  - `SuspiciousActivity`: Security monitoring

- **Views**:
  - Authentication (login, register, 2FA, password reset)
  - User CRUD operations
  - Business management
  - Custom domain verification

- **Features**:
  - JWT authentication with 1-day token expiry
  - Two-factor authentication (TOTP)
  - Role-based access (admin, agent, customer)
  - Multi-business support
  - Custom domain verification (DNS TXT/CNAME)

### 2. **Tenant Module** (`tenant/`)
**Purpose**: Core business functionality - tickets, SLA, knowledge base, chatbot, assets.

**Key Components**:

#### Tickets
- **Models**: `Ticket`, `TicketCategories`, `TicketComment`, `TicketAttachment`
- **Features**:
  - Multi-source ticket creation (email, web, phone, chat, chatbot, API)
  - Status workflow (created → assigned → in_progress → hold → closed)
  - Priority levels (low, medium, high, urgent)
  - Department routing
  - Contact linking
  - File attachments
  - SLA tracking

#### SLA (Service Level Agreement)
- **Models**: `SLA`, `SLATarget`, `SLACondition`, `SLAEscalations`, `SLAViolation`, `BusinessHoursx`, `Holidays`
- **Features**:
  - Calendar/business/custom operational hours
  - Priority-based targets
  - Multi-level escalations
  - Breach monitoring
  - Violation tracking
  - Holiday calendar integration

#### Knowledge Base
- **Models**: `KBCategory`, `KBArticle` (optimized, includes SEO, analytics, versioning)
- **Features**:
  - Hierarchical categories
  - SEO optimization (title, description, keywords)
  - AI-powered semantic search (pgvector embeddings)
  - Article versioning
  - Analytics tracking
  - Public/private articles
  - Featured content

#### Chatbot
- **Models**: `ChatbotConfig`, `ChatSession`, `ChatMessage`
- **Features**:
  - Gemini AI integration
  - Intent analysis
  - Ticket extraction from chat
  - Context-aware responses
  - Knowledge base integration
  - Conversation state management

#### Assets
- **Models**: Asset tracking for IT equipment
- **Features**:
  - Asset lifecycle management
  - Assignment tracking
  - Maintenance scheduling

#### Contacts
- **Models**: Customer contact management
- **Features**:
  - Contact profiles
  - Ticket history
  - Contact linking

#### Departments
- **Models**: `Department`, `DepartmentEmails`
- **Features**:
  - Department-based routing
  - Email configuration (IMAP/SMTP per department)
  - Member management

#### Tasks
- **Models**: Internal task management
- **Features**:
  - Task creation and assignment
  - Status tracking
  - Notifications

#### Notifications
- **Models**: `Notification`, `NotificationPreferences`
- **Features**:
  - Real-time WebSocket notifications
  - Email notifications
  - User preferences
  - Organization-wide settings

#### Mail Integration
- **Models**: `MailIntegration`, `MailFetchLog`
- **Features**:
  - OAuth2 (Google, Microsoft)
  - IMAP/SMTP configuration
  - Token refresh automation
  - Mailgun webhook handling
  - Email-to-ticket conversion

### 3. **Shared Module** (`shared/`)
**Purpose**: Cross-cutting concerns, base models, workers, and middleware.

**Key Components**:

#### Base Models
- `BaseEntity`: Standard fields (business, status, created_at, updated_at)
- `BaseUser`: Base user functionality

#### Middleware
- `CustomDomainMiddleware`: Routes requests based on custom domain
- `channels_jwt_auth_middleware`: JWT authentication for WebSockets

#### Workers (Celery)
- **Email.py**: Process emails and convert to tickets
- **Sla.py**: Monitor SLA breaches and trigger escalations
- **Task.py**: Task notifications
- **Ticket.py**: Ticket notifications
- **Request.py**: Request processing

#### Services
- `notification_preferences`: User notification settings

---

## Data Models

### Core Entity Relationships

```
Business (Multi-tenant root)
    ├── Users (agents, admins)
    ├── Customers
    ├── CustomDomains
    ├── Departments
    │   └── DepartmentEmails
    ├── TicketCategories
    ├── Tickets
    │   ├── TicketComments
    │   ├── TicketAttachments
    │   ├── assigned_to (User)
    │   ├── contact (Contact)
    │   └── sla (SLA)
    ├── SLA
    │   ├── SLATarget
    │   ├── SLACondition
    │   ├── SLAEscalations
    │   └── SLAViolation
    ├── BusinessHoursx
    ├── Holidays
    ├── KBCategory
    │   └── KBArticle (with vector embeddings)
    ├── ChatbotConfig
    │   ├── ChatSession
    │   └── ChatMessage
    ├── Assets
    ├── Contacts
    ├── Tasks
    ├── Notifications
    ├── MailIntegration
    └── Settings (SMTP, templates, etc.)
```

### Key Model Details

#### Business
```python
- id, name, owner, created_at, updated_at, is_active
- website, domain, domain_url, support_url
- email, phone, timezone
- logo_url, favicon_url
- organization_size
```

#### Users
```python
- BaseUser fields (first_name, last_name, email, phone, username)
- role (FK to Group: admin, agent, customer)
- department (M2M to Department)
- business (FK to Business)
- category (BUSINESS, CUSTOMER)
- status, avatar_url, is_superuser
```

#### Ticket
```python
- title, description, ticket_id
- category (FK), department (FK)
- creator_name, creator_email, creator_phone
- contact (FK to Contact)
- status (created, assigned, in_progress, hold, closed)
- priority (low, medium, high, urgent)
- source (email, web, phone, chat, chatbot, api, internal, customer_portal)
- sla (FK to SLA)
- assigned_to (FK to Users)
- customer_tier (premium, standard, basic)
- business (FK to Business)
```

#### SLA
```python
- name, description
- operational_hours (calendar, business, custom)
- evaluation_method (ticket_creation, conditions_met)
- is_active
- SLATarget: response_time, resolution_time, escalation rules
- SLACondition: priority, category, department, customer_type
```

#### KBArticle
```python
- title, slug, content, excerpt
- category (FK), author (FK)
- seo_title, seo_description, seo_keywords
- is_public, is_featured, sort_order
- metadata (JSON field)
- views_count, helpful_count, not_helpful_count
- embedding (pgvector field for semantic search)
```

---

## API Architecture

### API Structure

**Base URL**: `https://api.safaridesk.io/api/v1/`

### API Endpoints

#### Authentication (`/api/v1/auth/`)
```
POST   /register/                 # User registration
POST   /login/                    # Login (returns JWT)
POST   /logout/                   # Logout
POST   /password-reset/           # Request password reset
POST   /password-reset-confirm/   # Confirm password reset
POST   /verify-otp/               # 2FA verification
POST   /refresh/                  # Refresh JWT token
```

#### Users (`/api/v1/users/`)
```
GET    /                          # List users
POST   /                          # Create user
GET    /{id}/                     # Get user details
PUT    /{id}/                     # Update user
DELETE /{id}/                     # Delete user
GET    /profile/                  # Current user profile
```

#### Business (`/api/v1/business/`)
```
GET    /                          # List businesses
POST   /                          # Create business
GET    /{id}/                     # Get business details
PUT    /{id}/                     # Update business
DELETE /{id}/                     # Delete business
GET    /{id}/members/             # List business members
```

#### Custom Domains (`/api/v1/domains/`)
```
GET    /                          # List custom domains
POST   /                          # Add custom domain
GET    /{id}/                     # Get domain details
DELETE /{id}/                     # Remove domain
POST   /{id}/verify/              # Trigger verification
GET    /{id}/verification-status/ # Check verification status
```

#### Departments (`/api/v1/department/`)
```
GET    /                          # List departments
POST   /                          # Create department
GET    /{id}/                     # Get department
PUT    /{id}/                     # Update department
DELETE /{id}/                     # Delete department
GET    /{id}/members/             # Department members
POST   /{id}/emails/              # Add department email
```

#### Tickets (`/api/v1/ticket/`)
```
GET    /                          # List tickets (filtered by business)
POST   /                          # Create ticket
GET    /{id}/                     # Get ticket details
PUT    /{id}/                     # Update ticket
DELETE /{id}/                     # Delete ticket
POST   /{id}/comments/            # Add comment
GET    /{id}/comments/            # List comments
POST   /{id}/attachments/         # Add attachment
POST   /{id}/assign/              # Assign ticket
PUT    /{id}/status/              # Update status
PUT    /{id}/priority/            # Update priority
```

#### SLA (`/api/v1/sla/`)
```
GET    /                          # List SLAs
POST   /                          # Create SLA
GET    /{id}/                     # Get SLA details
PUT    /{id}/                     # Update SLA
DELETE /{id}/                     # Delete SLA
GET    /{id}/violations/          # SLA violations
GET    /dashboard/                # SLA dashboard
```

#### Tasks (`/api/v1/task/`)
```
GET    /                          # List tasks
POST   /                          # Create task
GET    /{id}/                     # Get task
PUT    /{id}/                     # Update task
DELETE /{id}/                     # Delete task
```

#### Knowledge Base (`/api/v1/kb/`)
```
GET    /categories/               # List categories
POST   /categories/               # Create category
GET    /categories/{id}/          # Get category
PUT    /categories/{id}/          # Update category
DELETE /categories/{id}/          # Delete category

GET    /articles/                 # List articles
POST   /articles/                 # Create article
GET    /articles/{id}/            # Get article
PUT    /articles/{id}/            # Update article
DELETE /articles/{id}/            # Delete article
POST   /articles/search/          # Semantic search
GET    /articles/{id}/analytics/  # Article analytics
```

#### Chatbot (`/api/v1/chatbot/`)
```
POST   /sessions/                 # Create chat session
POST   /sessions/{id}/messages/   # Send message
GET    /sessions/{id}/messages/   # Get conversation
POST   /config/                   # Update chatbot config
```

#### Assets (`/api/v1/assets/`)
```
GET    /                          # List assets
POST   /                          # Create asset
GET    /{id}/                     # Get asset
PUT    /{id}/                     # Update asset
DELETE /{id}/                     # Delete asset
```

#### Contacts (`/api/v1/contacts/`)
```
GET    /                          # List contacts
POST   /                          # Create contact
GET    /{id}/                     # Get contact
PUT    /{id}/                     # Update contact
DELETE /{id}/                     # Delete contact
GET    /{id}/tickets/             # Contact's tickets
```

#### Settings (`/api/v1/settings/`)
```
GET    /smtp/                     # Get SMTP settings
POST   /smtp/                     # Update SMTP settings
GET    /mail/integrations/        # List mail integrations
POST   /mail/integrations/        # Add integration
DELETE /mail/integrations/{id}/   # Remove integration
GET    /mail/integrations/google/oauth/  # Start Google OAuth
GET    /mail/integrations/microsoft/oauth/ # Start Microsoft OAuth
```

#### Dashboard (`/api/v1/dashboard/`)
```
GET    /stats/                    # Dashboard statistics
GET    /tickets/overview/         # Ticket overview
GET    /sla/performance/          # SLA performance
```

#### Notifications (`/api/v1/notifications/`)
```
GET    /                          # List notifications
PUT    /{id}/read/                # Mark as read
PUT    /read-all/                 # Mark all as read
GET    /preferences/              # Get preferences
PUT    /preferences/              # Update preferences
```

#### Public APIs (`/api/v1/public/`)
```
POST   /tickets/                  # Create ticket (public form)
GET    /kb/articles/              # Public KB articles
GET    /kb/search/                # Public KB search
```

### WebSocket Endpoints

```
ws://api.safaridesk.io/ws/notifications/
    - Real-time notification delivery

ws://api.safaridesk.io/ws/chat/{business_id}/{mode}/
    - Real-time chatbot interaction

ws://api.safaridesk.io/ws/setup/{business_id}/
    - Setup progress updates
```

### Webhook Endpoints

```
POST   /mailgun/inbound/          # Mailgun inbound email webhook
POST   /mailgun/inbound/mime      # Mailgun MIME email webhook
```

---

## Management Commands

### Core Setup Commands

#### 1. **safari**
**File**: `shared/management/commands/safari.py`

**Purpose**: Initialize SafariDesk core setup

**Usage**:
```bash
python manage.py safari
```

**Actions**:
- Seeds email configuration for all businesses
- Calls `datasync` command
- Sets up default email templates

---

#### 2. **datasync**
**File**: `shared/management/commands/datasync.py`

**Purpose**: Synchronize core data and create system users

**Usage**:
```bash
python manage.py datasync
```

**Actions**:
- Creates default user groups (admin, agent, customer, superuser)
- Seeds suspicious activity types
- Creates system user
- Optionally creates superuser

**Groups Created**:
- `admin`: Full administrative access
- `agent`: Support agent access
- `customer`: Customer access
- `superuser`: System-level superuser

---

#### 3. **install_pgvector**
**File**: `shared/management/commands/install_pgvector.py`

**Purpose**: Install PostgreSQL pgvector extension for vector embeddings

**Usage**:
```bash
python manage.py install_pgvector
```

**Actions**:
- Checks if pgvector extension exists
- Installs pgvector extension
- Verifies installation and shows version

**Use Case**: Required for AI-powered semantic search in knowledge base

---

### Email Management Commands

#### 4. **emails**
**File**: `shared/management/commands/emails.py`

**Purpose**: Process incoming emails and convert to tickets

**Usage**:
```bash
# Process all businesses asynchronously
python manage.py emails

# Process specific business
python manage.py emails --business 123

# Process synchronously (for testing)
python manage.py emails --sync

# Process specific business synchronously
python manage.py emails --business 123 --sync
```

**Options**:
- `--sync`: Run synchronously instead of using Celery
- `--business <id>`: Process only specific business

**Actions**:
- Fetches emails from all configured mail integrations
- Converts emails to tickets
- Links emails to existing tickets (via reply detection)
- Updates ticket status based on email content
- Handles attachments

---

#### 5. **update_imap_settings**
**File**: `shared/management/commands/update_imap_settings.py`

**Purpose**: Update IMAP settings for existing department emails

**Usage**:
```bash
# Show what would be updated
python manage.py update_imap_settings --dry-run

# Update for specific provider
python manage.py update_imap_settings --provider hostinger
python manage.py update_imap_settings --provider gmail
python manage.py update_imap_settings --provider outlook
```

**Options**:
- `--dry-run`: Preview changes without saving
- `--provider <name>`: Target specific email provider

**Supported Providers**:
- `hostinger`: imap.hostinger.com:993 (SSL)
- `gmail`: imap.gmail.com:993 (SSL)
- `outlook`: outlook.office365.com:993 (SSL)
- `yahoo`: imap.mail.yahoo.com:993 (SSL)

---

### SLA Management Commands

#### 6. **sla**
**File**: `shared/management/commands/sla.py`

**Purpose**: Monitor SLA compliance and trigger escalations

**Usage**:
```bash
# Monitor all businesses
python manage.py sla

# Dry run (no actual notifications or DB changes)
python manage.py sla --dry-run
```

**Options**:
- `--dry-run`: Test mode without sending notifications or saving changes

**Actions**:
- Iterates through all active businesses
- Checks SLA targets for all tickets and tasks
- Triggers escalations when thresholds are met
- Records SLA violations
- Sends notifications to relevant parties

**Typical Schedule**: Run via Celery Beat every 5-15 minutes

---

### Domain Management Commands

#### 7. **verify_domains**
**File**: `users/management/commands/verify_domains.py`

**Purpose**: Verify custom domain DNS records

**Usage**:
```bash
# Verify specific domain
python manage.py verify_domains --domain example.com

# Verify all pending domains
python manage.py verify_domains --all

# Retry failed domains
python manage.py verify_domains --retry-failed
```

**Options**:
- `--domain <domain>`: Verify specific domain
- `--all`: Verify all pending domains
- `--retry-failed`: Retry previously failed verifications

**Actions**:
- Checks DNS TXT or CNAME records
- Updates domain verification status
- Enables custom domain routing on success

---

### Data Management Commands

#### 8. **add_default_departments_and_categories**
**File**: `tenant/management/commands/add_default_departments_and_categories.py`

**Purpose**: Seed default departments and KB categories

**Usage**:
```bash
python manage.py add_default_departments_and_categories
```

**Default Departments**:
- Human Resources (HR)
- Finance/Accounting
- IT/Technology
- Marketing/Sales

**Default KB Categories**:
- Account & Access
- Billing & Payments
- Technical Support
- Product Guides
- Policies & Compliance

---

#### 9. **generate_kb_embeddings**
**File**: `tenant/management/commands/generate_kb_embeddings.py`

**Purpose**: Generate vector embeddings for knowledge base articles

**Usage**:
```bash
# Generate for specific business
python manage.py generate_kb_embeddings --business-id 123

# Generate for all businesses
python manage.py generate_kb_embeddings --all

# Regenerate existing embeddings
python manage.py generate_kb_embeddings --all --include-existing
```

**Options**:
- `--business-id <id>`: Process specific business
- `--all`: Process all businesses
- `--include-existing`: Recreate embeddings even if they exist

**Actions**:
- Generates text embeddings using AI service
- Stores embeddings in pgvector format
- Enables semantic search capabilities

---

## Background Tasks & Workers

### Celery Configuration

**Broker & Result Backend**: Redis  
**Task Serializer**: JSON  
**Timezone**: UTC  
**Workers**: 2 concurrent workers

### Scheduled Tasks (Celery Beat)

#### 1. **refresh-mail-integration-tokens**
**Schedule**: Every hour (hourly)  
**Task**: `shared.tasks.refresh_mail_integration_tokens`

**Purpose**:
- Refreshes OAuth2 access tokens for Google and Microsoft integrations
- Prevents token expiration
- Updates tokens in database with encryption

**Implementation**:
```python
from util.mail import refresh_google_token, refresh_microsoft_token

# Iterates through all MailIntegration objects
# Checks token expiry time
# Refreshes if within 5 minutes of expiry
```

---

#### 2. **sync-mail-integrations**
**Schedule**: Every 5 minutes  
**Task**: `shared.tasks.sync_mail_integrations`

**Purpose**:
- Fetches new emails from all configured mail integrations
- Converts emails to tickets
- Updates existing tickets from replies
- Logs fetch operations

**Implementation**:
- Uses `MailIngestionCoordinator` and `MailIntegrationIngestionService`
- Supports IMAP and OAuth2 methods
- Handles MIME message parsing
- Extracts attachments

---

### Worker Tasks

#### Email Workers (`shared/workers/Email.py`)

**Tasks**:
- `process_emails_for_all_businesses`: Main email processing dispatcher
- `process_business_emails`: Process emails for specific business
- `process_department_emails`: Process emails for specific department
- `convert_email_to_ticket`: Convert individual email to ticket

**Features**:
- Email parsing and sanitization
- Attachment extraction
- Contact linking
- Reply detection (updates existing tickets)
- Email threading

---

#### SLA Workers (`shared/workers/Sla.py`)

**Tasks**:
- `check_sla_for_business_task`: Monitor SLA for business
- `check_sla_breaches`: Check individual ticket/task SLA
- `trigger_escalation`: Send escalation notifications

**Features**:
- Business hour calculation
- Holiday handling
- Multi-level escalations
- Violation recording
- First response tracking
- Resolution time tracking

---

#### Ticket Workers (`shared/workers/Ticket.py`)

**Tasks**:
- `send_ticket_created_notification`: Notify on ticket creation
- `send_ticket_assigned_notification`: Notify on ticket assignment
- `send_ticket_status_changed_notification`: Notify on status change
- `send_new_comment_notification`: Notify on new comment

---

#### Task Workers (`shared/workers/Task.py`)

**Tasks**:
- `task_created_agent_notification`: Notify on task creation
- `task_assigned_notification`: Notify on task assignment
- `task_status_changed_notification`: Notify on task status change
- `new_public_reply_agent_notification`: Notify on public reply
- `private_note_added_notification`: Notify on private note

---

#### Domain Tasks (`shared/tasks/domain_tasks.py`)

**Tasks**:
- `verify_domain_task`: Asynchronous domain verification
- `check_domain_expiry`: Monitor domain SSL certificate expiry

---

### Manual Task Invocation

**Via Django Shell**:
```python
from shared.tasks import sync_mail_integrations
sync_mail_integrations.delay()
```

**Via Management Command**:
```bash
python manage.py emails --sync
python manage.py sla
```

---

## Real-Time Features

### WebSocket Architecture

**ASGI Server**: Daphne  
**Channel Layer**: Redis  
**Middleware**: JWT authentication for WebSocket connections

### WebSocket Consumers

#### 1. **NotificationConsumer**
**File**: `tenant/consumers/notification_consumer.py`  
**URL**: `ws://api.safaridesk.io/ws/notifications/`

**Purpose**: Real-time notification delivery

**Flow**:
1. Client connects with JWT token in query params
2. Consumer authenticates user
3. Adds connection to user's notification group
4. Sends notifications in real-time when events occur
5. Client acknowledges receipt

**Message Format**:
```json
{
  "type": "notification",
  "data": {
    "id": 123,
    "title": "New Ticket Assigned",
    "message": "Ticket #1234 has been assigned to you",
    "type": "ticket_assigned",
    "created_at": "2025-12-16T10:30:00Z",
    "read": false
  }
}
```

---

#### 2. **ChatConsumer**
**File**: `tenant/consumers/ChatConsumer.py`  
**URL**: `ws://api.safaridesk.io/ws/chat/{business_id}/{mode}/`

**Purpose**: Real-time AI chatbot interaction

**Modes**:
- `agent`: Agent-facing chat
- `customer`: Customer-facing chat

**Flow**:
1. Client connects with business_id and mode
2. Creates or resumes chat session
3. Client sends messages
4. AI processes message (intent analysis, KB search, ticket extraction)
5. AI response streamed back in real-time
6. Session state maintained

**Message Format**:
```json
{
  "type": "message",
  "message": "I need help with my password",
  "session_id": "uuid-here"
}
```

**Response Format**:
```json
{
  "type": "ai_response",
  "message": "I can help you reset your password...",
  "intent": "password_reset",
  "confidence": 0.95,
  "suggested_articles": [...]
}
```

**Features**:
- Context-aware responses
- Knowledge base integration
- Automatic ticket creation
- Intent detection
- Conversation history

---

#### 3. **SetupConsumer**
**File**: `tenant/setup_consumer.py`  
**URL**: `ws://api.safaridesk.io/ws/setup/{business_id}/`

**Purpose**: Real-time setup progress updates

**Use Case**: Business onboarding, showing progress of setup steps

---

### Channel Groups

**Notification Groups**:
- `notifications_user_{user_id}`: Individual user notifications
- `notifications_business_{business_id}`: Business-wide notifications
- `notifications_department_{dept_id}`: Department notifications

**Chat Groups**:
- `chat_session_{session_id}`: Individual chat session

---

## Security & Authentication

### Authentication Methods

#### 1. **JWT (JSON Web Tokens)**
**Library**: `djangorestframework-simplejwt`

**Configuration**:
- **Access Token Lifetime**: 1 day
- **Refresh Token Lifetime**: 1 day
- **Algorithm**: HS256
- **Blacklist**: Enabled (tokens blacklisted on rotation)
- **Update Last Login**: Enabled

**Headers**:
```
Authorization: Bearer <access_token>
```

**Endpoints**:
- `POST /api/v1/auth/login/`: Get tokens
- `POST /api/v1/auth/refresh/`: Refresh access token

---

#### 2. **Two-Factor Authentication (2FA)**
**Library**: `django-otp`

**Methods**:
- TOTP (Time-based One-Time Password)
- Static backup codes

**Flow**:
1. User enables 2FA in settings
2. QR code generated for authenticator app
3. Backup codes provided
4. On login, user provides TOTP code
5. Token issued only after successful 2FA

---

#### 3. **OAuth2 Integration**
**Providers**: Google, Microsoft

**Purpose**: Email integration authentication

**Flow**:
1. User initiates OAuth flow
2. Redirected to provider's consent screen
3. User grants permissions
4. Callback with authorization code
5. Backend exchanges code for tokens
6. Tokens encrypted and stored

**Encryption**: Fernet symmetric encryption for OAuth tokens and passwords

---

### Authorization

#### Role-Based Access Control (RBAC)

**Groups**:
- **superuser**: System administrator, full access
- **admin**: Business administrator, manage business settings
- **agent**: Support agent, handle tickets
- **customer**: External customer, create/view own tickets

**Permissions**:
- View-level permissions using DRF permission classes
- Object-level permissions based on business relationship
- Custom permissions for specific actions

---

### Custom Domain Middleware

**File**: `shared/middleware/CustomDomainMiddleware.py`

**Purpose**: Multi-tenant routing based on custom domain

**Flow**:
1. Extract hostname from request
2. Check cache for domain-to-business mapping
3. If not cached, query `CustomDomains` table
4. Attach `request.custom_domain_business` to request
5. Views filter data by business automatically

**Caching**: 5-minute cache for domain lookups

---

### Security Features

1. **Password Hashing**: Django's PBKDF2 with SHA256
2. **CSRF Protection**: Enabled for all POST/PUT/DELETE requests
3. **CORS**: Configurable allowed origins
4. **SQL Injection Prevention**: ORM-based queries
5. **XSS Prevention**: Template auto-escaping
6. **Rate Limiting**: (Recommended to implement with Django Ratelimit)
7. **Encryption**: Fernet encryption for sensitive credentials
8. **Suspicious Activity Tracking**: Login attempts, failed auth

---

## Integration Points

### 1. **Email Integrations**

#### Mailgun
**Purpose**: Inbound email routing and webhooks

**Configuration**:
- Domain: `safaridesk.io`
- Webhook URL: `/mailgun/inbound/mime`
- Signing Key: Validates webhook authenticity

**Flow**:
1. Customer sends email to `support@business-domain.com`
2. Mailgun receives and forwards to webhook
3. Webhook validates signature
4. Email parsed and converted to ticket
5. Attachments extracted and stored

---

#### IMAP/SMTP
**Purpose**: Direct email fetching and sending

**Configuration**: Per-department email settings
- IMAP: Fetch incoming emails
- SMTP: Send outgoing emails

**Providers Supported**:
- Hostinger
- Gmail
- Outlook
- Yahoo
- Generic IMAP/SMTP

---

#### OAuth2 (Google & Microsoft)
**Purpose**: Secure email integration without storing passwords

**Google OAuth**:
- Client ID: `GOOGLE_OAUTH_CLIENT_ID`
- Client Secret: `GOOGLE_OAUTH_CLIENT_SECRET`
- Redirect URI: `/settings/mail/integrations/google/callback/`
- Scopes: `gmail.readonly`, `gmail.send`

**Microsoft OAuth**:
- Client ID: `MICROSOFT_OAUTH_CLIENT_ID`
- Client Secret: `MICROSOFT_OAUTH_CLIENT_SECRET`
- Tenant: `common` (multi-tenant)
- Redirect URI: `/settings/mail/integrations/microsoft/callback/`
- Scopes: `Mail.Read`, `Mail.Send`

**Token Refresh**: Automated via Celery Beat task (hourly)

---

### 2. **AI Services**

#### Google Gemini API
**Purpose**: AI chatbot, intent analysis, ticket extraction

**Models Used**:
- `gemini-1.5-flash`: Fast responses for chatbot
- `gemini-1.5-pro`: Advanced reasoning for complex queries

**Features**:
- Natural language understanding
- Context-aware responses
- Knowledge base search integration
- Ticket field extraction
- Conversation state management

**Files**:
- `tenant/services/ai/gemini_client.py`: API client
- `tenant/services/ai/intent_analyzer.py`: Intent detection
- `tenant/services/ai/ticket_extractor.py`: Extract ticket fields from text
- `tenant/services/ai/conversation_state.py`: Maintain context

---

#### Embeddings Service
**Purpose**: Semantic search in knowledge base

**Implementation**: OpenAI-compatible embeddings API

**Features**:
- Generate embeddings for KB articles
- Store in pgvector format
- Similarity search using cosine distance

**Files**:
- `tenant/services/ai/embedding_service.py`: Embedding generation
- `tenant/services/ai/kb_search.py`: Semantic search

---

### 3. **Custom Domains**

#### Domain Verification
**Methods**:
- **DNS TXT Record**: `_safaridesk-verification=<token>`
- **DNS CNAME Record**: `_safaridesk-verification -> verification.safaridesk.io`

**Service**: `util/DomainVerificationService.py`

**Process**:
1. Business adds custom domain
2. Verification token generated
3. Business adds DNS record
4. `verify_domains` command checks DNS
5. Domain marked as verified
6. Middleware routes requests to business

---

### 4. **File Storage**

**Location**: `/mnt/safaridesk`

**Structure**:
```
/mnt/safaridesk/
├── files/          # Ticket attachments
└── kb/             # Knowledge base files
```

**Upload Limits**:
- Max file size: 10MB
- Supported types: All (filtered by application logic)

---

## Deployment Architecture

### Docker Compose Services

```yaml
services:
  - frontend:     Nginx serving React/Vue app (port 8000)
  - web:          Django API (Gunicorn, port 8100)
  - celery:       Celery worker (2 concurrent tasks)
  - celery-beat:  Celery scheduler
  - channels:     WebSocket server (Daphne, port 8101)
  - redis:        Redis 6.x (cache, broker, channel layer)
  - db:           PostgreSQL 16 with pgvector
```

### Container Details

#### **web** (Django API)
- **Image**: Custom Dockerfile
- **Command**: 
  ```bash
  python manage.py collectstatic --noinput &&
  python manage.py install_pgvector &&
  python manage.py migrate --noinput &&
  python manage.py safari &&
  gunicorn RNSafarideskBack.wsgi:application --bind 0.0.0.0:8100 --workers 3
  ```
- **Workers**: 3 Gunicorn workers
- **Port**: 8100
- **Volumes**: 
  - `.:/app` (code)
  - `gunicorn_logs:/var/log/gunicorn`
  - `safari:/mnt` (media)

#### **celery** (Background Workers)
- **Image**: Same as web
- **Command**: 
  ```bash
  celery -A RNSafarideskBack.celery worker --loglevel=info --concurrency=2
  ```
- **Concurrency**: 2 workers
- **Volumes**: Same as web

#### **celery-beat** (Scheduler)
- **Image**: Same as web
- **Command**: 
  ```bash
  celery -A RNSafarideskBack.celery beat --loglevel=info
  ```
- **Purpose**: Triggers periodic tasks (email sync, SLA checks)

#### **channels** (WebSocket Server)
- **Image**: Same as web
- **Command**: 
  ```bash
  daphne -b 0.0.0.0 -p 8101 RNSafarideskBack.asgi:application
  ```
- **Port**: 8101
- **Purpose**: Handles WebSocket connections

#### **redis**
- **Image**: `redis:6-alpine`
- **Port**: 6379
- **Purpose**: 
  - Celery broker
  - Cache backend
  - Channels layer
  - Session storage

#### **db** (PostgreSQL)
- **Image**: Custom with pgvector
- **Port**: 5432
- **Extensions**: pgvector
- **Health Check**: `pg_isready` command

---

### Environment Variables

**Critical Variables**:
```env
# Django
DJANGO_SETTINGS_MODULE=RNSafarideskBack.settings.prod
SECRET_KEY=<secret>
DEBUG=False

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=safaridesk
DB_USER=postgres
DB_PASSWORD=<password>
DB_HOST=db
DB_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<optional>

# Email
SECRET_ENCRYPTION_KEY=<fernet-key>
MAILGUN_API_KEY=<key>
MAILGUN_DOMAIN=safaridesk.io
MAILGUN_API_BASE_URL=https://api.eu.mailgun.net
MAILGUN_SIGNING_KEY=<key>

# OAuth
GOOGLE_OAUTH_CLIENT_ID=<id>
GOOGLE_OAUTH_CLIENT_SECRET=<secret>
MICROSOFT_OAUTH_CLIENT_ID=<id>
MICROSOFT_OAUTH_CLIENT_SECRET=<secret>

# File Storage
FILE_BASE_URL=https://api.safaridesk.io
FILE_URL=/uploads/files/
AVATARS_URL=/uploads/avatars/
```

---

### Production Deployment

**Recommended Stack**:
- **Reverse Proxy**: Nginx/Caddy
- **SSL**: Let's Encrypt (via Certbot or Caddy)
- **Database**: Managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- **Redis**: Managed Redis (AWS ElastiCache, Redis Cloud)
- **Object Storage**: AWS S3 / DigitalOcean Spaces (for files)
- **Monitoring**: Sentry, New Relic, Datadog
- **Logging**: ELK Stack, CloudWatch

**Scaling Considerations**:
- Horizontal scaling: Multiple web/celery containers
- Database read replicas
- Redis Sentinel for high availability
- Load balancer for web services

---

## Scalability & Performance

### Optimization Strategies

#### 1. **Database Optimization**
- **Indexes**: Strategic indexes on foreign keys, status fields, timestamps
- **Query Optimization**: `select_related()` and `prefetch_related()` for joins
- **Connection Pooling**: PgBouncer recommended
- **Partitioning**: Consider partitioning tickets table by date for large datasets

#### 2. **Caching**
- **Redis Cache**: 5-minute cache for domain lookups
- **Query Caching**: Cache expensive queries (dashboard stats, KB articles)
- **CDN**: Static files and media served via CDN

#### 3. **Async Processing**
- **Celery**: All heavy tasks (email processing, SLA checks) run asynchronously
- **Rate Limiting**: Prevent API abuse

#### 4. **pgvector Performance**
- **HNSW Index**: Use HNSW index for fast approximate nearest neighbor search
- **Embedding Dimensions**: Optimize embedding size (e.g., 768 or 1536 dimensions)

#### 5. **WebSocket Scaling**
- **Redis Channel Layer**: Allows multiple Daphne instances
- **Load Balancing**: Sticky sessions for WebSocket connections

#### 6. **API Performance**
- **Pagination**: Limit-offset pagination (configurable PAGE_SIZE)
- **Field Selection**: Allow clients to specify fields
- **Response Compression**: Enable gzip compression

---

### Performance Benchmarks (Estimated)

| Operation | Response Time | Throughput |
|-----------|---------------|------------|
| List Tickets (100 items) | < 100ms | 100 req/s |
| Create Ticket | < 200ms | 50 req/s |
| KB Semantic Search | < 300ms | 30 req/s |
| WebSocket Message | < 50ms | 1000 msg/s |
| Email Processing | 2-5s per email | Async |
| SLA Check (per business) | 5-10s | Async |

---

### Monitoring Recommendations

**Metrics to Track**:
- API response times (p50, p95, p99)
- Celery task queue length
- Redis memory usage
- PostgreSQL query performance
- WebSocket connection count
- SLA breach rate
- Email processing lag

**Tools**:
- **APM**: Sentry, New Relic
- **Logs**: Structured logging (JSON) + ELK
- **Metrics**: Prometheus + Grafana
- **Uptime**: UptimeRobot, Pingdom

---

## Conclusion

SafariDesk is a sophisticated multi-tenant ticketing platform with the following strengths:

### ✅ Strengths:
1. **Well-Structured**: Clean separation of concerns (users, tenant, shared)
2. **Multi-Tenant**: Business isolation with custom domain support
3. **Comprehensive**: Tickets, SLA, KB, chatbot, assets, contacts
4. **Real-Time**: WebSocket support for notifications and chat
5. **AI-Powered**: Gemini integration and semantic search
6. **Extensible**: Modular design, easy to add new features
7. **Production-Ready**: Docker Compose, Celery, proper auth

### 🔧 Recommendations:
1. **Rate Limiting**: Add Django Ratelimit for API protection
2. **API Versioning**: Consider explicit versioning (currently v1)
3. **Testing**: Add comprehensive unit and integration tests
4. **Documentation**: Auto-generate API docs (drf-spectacular)
5. **Monitoring**: Integrate APM and error tracking
6. **Backup Strategy**: Automated database and file backups
7. **CDN Integration**: Serve media files via CDN
8. **Search Engine**: Consider Elasticsearch for advanced search
9. **Message Queue**: Consider RabbitMQ for Celery in production
10. **Security Audit**: Regular security audits and penetration testing

---

**Generated**: December 16, 2025  
**Version**: 1.0  
**Author**: SafariDesk Development Team
