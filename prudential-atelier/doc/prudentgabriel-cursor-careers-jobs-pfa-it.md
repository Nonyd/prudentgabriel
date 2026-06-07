# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Careers Page + Job Applications + PFA IT Applications
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. No login required for job applications or IT applications.
3. The PFA verification system is built with a pluggable abstraction layer — real connection added later.
4. Admin can add custom fields per job posting.
5. Run `pnpm exec tsc --noEmit` after each section.

---

## SECTION 1 — DATABASE SCHEMA

Add to `prisma/schema.prisma`:

```prisma
// Job posting
model JobPosting {
  id           String   @id @default(cuid())
  title        String
  department   String
  type         JobType  // FULL_TIME, PART_TIME, FREELANCE, INTERNSHIP, IT_PLACEMENT
  location     String   // e.g. "Lagos, Nigeria" or "Remote"
  description  String   @db.Text
  requirements String   @db.Text
  benefits     String?  @db.Text
  salaryRange  String?  // e.g. "₦150,000 – ₦250,000/month"
  deadline     DateTime?
  isPublished  Boolean  @default(false)
  isPFAPosition Boolean @default(false) // true = IT/internship for PFA students
  slug         String   @unique
  
  // Custom fields defined by admin
  customFields Json?    // Array of CustomField definitions
  
  applications JobApplication[]
  
  createdBy    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@index([isPublished, type])
}

enum JobType {
  FULL_TIME
  PART_TIME
  FREELANCE
  INTERNSHIP
  IT_PLACEMENT  // PFA Industrial Training
}

// Job application
model JobApplication {
  id          String      @id @default(cuid())
  jobId       String
  job         JobPosting  @relation(fields: [jobId], references: [id])
  
  // Standard fields
  fullName    String
  email       String
  phone       String
  yearsOfExp  Int?
  coverLetter String?  @db.Text
  cvUrl       String?  // Cloudinary PDF URL
  portfolioUrl String? // Cloudinary PDF URL or external link
  heardFrom   String?  // "Instagram", "Referred by friend", etc.
  
  // PFA IT specific fields
  isPFAApplication Boolean @default(false)
  pfaRegNumber     String?  // PFA registration number
  pfaVerified      Boolean @default(false)
  pfaStudentName   String?  // returned from PFA verification
  pfaCourse        String?  // e.g. "Fashion Design"
  pfaYear          Int?     // year of study
  universityName   String?
  supervisorName   String?
  supervisorEmail  String?
  supervisorPhone  String?
  itDuration       String?  // e.g. "6 months"
  itStartDate      DateTime?
  schoolItLetter   String?  // Cloudinary PDF URL
  schoolIdCard     String?  // Cloudinary PDF URL
  
  // Custom field responses
  customResponses  Json?    // { fieldId: value }
  
  // Status tracking
  status      ApplicationStatus @default(NEW)
  adminNotes  String?  @db.Text
  
  // Communication log
  emailsSent  ApplicationEmail[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([jobId, status])
  @@index([email])
}

enum ApplicationStatus {
  NEW
  REVIEWED
  SHORTLISTED
  INTERVIEWED
  REJECTED
  HIRED
}

model ApplicationEmail {
  id            String         @id @default(cuid())
  applicationId String
  application   JobApplication @relation(fields: [applicationId], references: [id])
  subject       String
  body          String         @db.Text
  sentAt        DateTime       @default(now())
  sentBy        String         // admin userId
}
```

Run `prisma db push` after adding.

---

## SECTION 2 — PFA VERIFICATION ABSTRACTION LAYER

Build `src/lib/pfa-verify.ts`:

```typescript
export interface PFAStudentInfo {
  valid: boolean
  regNumber?: string
  name?: string
  course?: string
  year?: number
  graduationYear?: number
  isEligibleForIT?: boolean
  error?: string
}

export async function verifyPFAStudent(
  regNumber: string
): Promise<PFAStudentInfo> {
  const method = process.env.PFA_VERIFY_METHOD || 'mock'
  
  // Normalize reg number
  const normalized = regNumber.trim().toUpperCase()
  
  if (method === 'api') {
    // Phase 2: Call PFA API endpoint
    // Set PFA_API_URL and PFA_API_KEY in env vars
    try {
      const res = await fetch(
        `${process.env.PFA_API_URL}/api/verify-student?regNumber=${normalized}`,
        {
          headers: { 'Authorization': `Bearer ${process.env.PFA_API_KEY}` }
        }
      )
      if (!res.ok) return { valid: false, error: 'Student not found' }
      return await res.json()
    } catch {
      return { valid: false, error: 'Verification service unavailable' }
    }
    
  } else if (method === 'db') {
    // Phase 2: Query shared Neon database directly
    // Set PFA_DATABASE_URL in env vars
    // const pfaPrisma = new PrismaClient({ datasources: { db: { url: process.env.PFA_DATABASE_URL } } })
    // const student = await pfaPrisma.student.findUnique({ where: { regNumber: normalized } })
    // return student ? { valid: true, name: student.name, course: student.course, ... } : { valid: false }
    return { valid: false, error: 'DB method not yet configured' }
    
  } else {
    // MOCK MODE — for development and testing
    // Accepts any reg number in format PFA/YYYY/NNNN
    const pfaRegPattern = /^PFA\/\d{4}\/\d{3,4}$/
    if (!pfaRegPattern.test(normalized)) {
      return { 
        valid: false, 
        error: 'Invalid registration number format. Expected: PFA/YYYY/NNNN' 
      }
    }
    
    // Mock response for valid format
    return {
      valid: true,
      regNumber: normalized,
      name: 'Demo PFA Student',
      course: 'Fashion Design & Technology',
      year: 3,
      graduationYear: 2026,
      isEligibleForIT: true,
    }
  }
}
```

Add to `.env.local` and Vercel:
```
PFA_VERIFY_METHOD=mock   # change to 'api' or 'db' after meeting
PFA_API_URL=             # set after meeting
PFA_API_KEY=             # set after meeting
```

---

## SECTION 3 — CUSTOM FIELDS SYSTEM

Admin can add custom fields to any job posting.

### Field type definitions:

```typescript
// src/lib/job-custom-fields.ts

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'dropdown'
  | 'multi_select'
  | 'file_upload'
  | 'yes_no'
  | 'date'
  | 'number'
  | 'phone'
  | 'url'
  | 'rating_scale'
  | 'section_heading'

export interface CustomField {
  id: string          // unique ID within this job
  type: FieldType
  label: string       // shown to applicant
  placeholder?: string
  required: boolean
  options?: string[]  // for dropdown and multi_select
  minValue?: number   // for rating_scale
  maxValue?: number   // for rating_scale
  helpText?: string   // shown below the field
  order: number       // display order
}

export interface CustomFieldResponse {
  fieldId: string
  value: string | string[] | number | boolean
}
```

### Custom field builder UI (in admin job editor):

```
CUSTOM FIELDS
──────────────────────────────────────────
[+ Add Field] dropdown:
  Text Input
  Long Text (Textarea)
  Dropdown (single select)
  Multi-select checkboxes
  File Upload (PDF/Image)
  Yes / No
  Date Picker
  Number
  Phone Number
  URL / Website
  Rating Scale (1–5)
  ── Section Heading ──

Each added field shows as a card:
┌─────────────────────────────────────────┐
│  ≡  [drag handle]   TEXT INPUT          │
│  Label: [________________________]       │
│  Placeholder: [__________________]       │
│  Help text: [____________________]       │
│  Required: [toggle]                      │
│                                    [×]  │
└─────────────────────────────────────────┘

For DROPDOWN / MULTI_SELECT:
  Options: [Option 1] [×]
           [Option 2] [×]
           [+ Add option]

For RATING_SCALE:
  Min: [1]  Max: [5]
  Label low: [Poor]  Label high: [Excellent]

Drag to reorder fields.
```

---

## SECTION 4 — PUBLIC CAREERS PAGE

### `/careers` — Job listings page:

```
[Navbar]

┌─────────────────────────────────────────────┐
│  CAREERS                                    │
│  Join the house                             │  Cormorant 56px
│  "We are always looking for exceptional     │
│   people who love what they do."            │  Lora 16px italic
└─────────────────────────────────────────────┘

Filter bar:
[ALL]  [FULL-TIME]  [PART-TIME]  [FREELANCE]  [INTERNSHIP]  [IT PLACEMENT]

Job listing cards:
┌─────────────────────────────────────────────┐
│  Senior Tailor                              │
│  Production · Full-time · Lagos             │
│  Application deadline: June 30, 2026        │
│                          [VIEW & APPLY →]   │
└─────────────────────────────────────────────┘

If isPFAPosition: show a special badge:
"PFA STUDENTS" amber pill on the card
```

**Fetch:** Published jobs only (`isPublished: true`), ordered by `createdAt` desc.

---

### `/careers/[slug]` — Job detail + application:

Two column layout:

**Left (60%) — Job details:**
```
[Department pill]  [Job type pill]  [Location]

Senior Tailor                        Cormorant 48px
──────────────────────────────────

ABOUT THIS ROLE
[description — rich text from TipTap]

WHAT WE'RE LOOKING FOR
[requirements — rich text]

WHAT WE OFFER
[benefits — rich text]

₦150,000 – ₦250,000/month
Apply before: June 30, 2026
```

**Right (40%) — Application form (sticky):**

```
APPLY FOR THIS ROLE
──────────────────────────────────

[Standard fields]
Full Name *
Email Address *
Phone Number *
Years of Experience
  [0-1]  [1-3]  [3-5]  [5-10]  [10+]
  (radio pills)

CV / Resume *
  [Upload PDF] ← Cloudinary
  Max 5MB · PDF only

Portfolio (optional)
  [Upload PDF] or [Paste URL]

How did you hear about us?
  [dropdown]:
  Instagram · TikTok · Referral · 
  LinkedIn · Job board · Other

Cover Letter
  [textarea] optional, max 1000 chars

[Custom fields rendered here in order]

[SUBMIT APPLICATION →]
```

**For PFA IT placement positions** (`isPFAPosition: true`):
Show a special section ABOVE the standard form:

```
PFA STUDENT VERIFICATION
──────────────────────────────────
This position is open to PFA students 
applying for Industrial Training (IT).

Your PFA Registration Number:
[________________________]  [VERIFY →]

[After successful verification:]
✓ Verified: Amaka Nwosu
  Fashion Design & Technology · Year 3

[If verification fails:]
✗ Registration number not found.
  Contact PFA admin if you believe this is an error.
```

Verification is real-time:
- Client types reg number → clicks VERIFY
- `POST /api/careers/verify-pfa` called
- Shows success (name + course) or error
- Cannot submit without successful verification

---

## SECTION 5 — APPLICATION SUBMISSION

### API: `POST /api/careers/[slug]/apply`

No auth required (public endpoint).

```typescript
// Rate limiting: max 3 applications per IP per hour
// Validation: all required fields present
// File uploads: CV and any file fields via Cloudinary

// On success:
// 1. Create JobApplication record
// 2. Send confirmation email to applicant
// 3. Send notification email to admin
// 4. Create AdminNotification
// 5. Return { success: true, applicationId }
```

**Confirmation email to applicant:**
```
Subject: "Application received — [Job Title] at Prudential Atelier"

Hi [Name],

Thank you for applying for the [Job Title] position 
at Prudential Atelier.

We have received your application and will review 
it carefully. If your profile matches what we are 
looking for, we will be in touch within 14 working days.

Application reference: [applicationId]

— The Prudential Atelier Team
```

**Admin notification email:**
```
Subject: "New application: [Job Title] — [Applicant Name]"

New job application received.

Position: [Job Title]
Applicant: [Name]
Email: [email]
Phone: [phone]
Experience: [yearsOfExp]

Review at: prudentgabriel.com/admin/careers/applications/[id]
```

**AdminNotification:**
```typescript
await createAdminNotification({
  type: 'JOB_APPLICATION',
  title: 'New job application',
  message: `${name} applied for ${job.title}`,
  link: `/admin/careers/applications/${applicationId}`,
})
```

### API: `POST /api/careers/verify-pfa`

```typescript
// Body: { regNumber: string }
// Returns: PFAStudentInfo
const result = await verifyPFAStudent(regNumber)
return NextResponse.json(result)
```

---

## SECTION 6 — ADMIN CAREERS MANAGEMENT

### Admin sidebar — add "Careers" section:

```
CAREERS
  Job Postings
  Applications
```

Both visible to ADMIN and SUPER_ADMIN only.

---

### `/admin/careers` — Job Postings list:

```
Careers
Manage job postings and applications.
                                    [+ New Job Posting]

┌────────────────────────────────────────────────────────────────┐
│ TITLE          │ DEPT    │ TYPE      │ APPS │ STATUS  │ ACTIONS│
├────────────────────────────────────────────────────────────────┤
│ Senior Tailor  │ Prod.   │ Full-time │  12  │ ● Live  │ Edit   │
│ Head Beader    │ Prod.   │ Full-time │   3  │ ● Live  │ Edit   │
│ IT Placement   │ General │ IT        │   8  │ ● Live  │ Edit   │
│ Social Media   │ Marketing│ Part-time│   0  │ ○ Draft │ Edit   │
└────────────────────────────────────────────────────────────────┘
```

Status pills:
- Live (isPublished: true): green dot
- Draft (isPublished: false): grey dot
- Expired (deadline passed): amber dot

---

### `/admin/careers/new` and `/admin/careers/[id]/edit` — Job editor:

**Fields:**
```
Job Title:         [________________________]
Department:        [________________________]  free text
Job Type:          [Full-time ▾]
Location:          [________________________]
Salary Range:      [________________________]  optional
Application Deadline: [date picker]           optional

PFA Position:      [toggle]
"Enable this for IT/internship roles open to PFA students"

Description:       [TipTap rich text editor]
Requirements:      [TipTap rich text editor]
Benefits:          [TipTap rich text editor]

CUSTOM FIELDS
[Custom field builder — see Section 3]

Published:         [toggle]

[SAVE AS DRAFT]    [PUBLISH JOB]
```

Auto-generates slug from title.

---

### `/admin/careers/applications` — All applications:

Filter by:
- Job posting (dropdown)
- Status (New/Reviewed/Shortlisted/Interviewed/Rejected/Hired)
- Date range
- PFA applications only (toggle)

Table columns:
- Applicant name + email
- Position applied for
- Date submitted
- Status (colour-coded pill)
- PFA verified (checkmark if isPFAApplication + pfaVerified)
- Actions: View, Download CV

---

### `/admin/careers/applications/[id]` — Application detail:

Full application view:

```
┌──────────────────────────────────────────────────────────────┐
│  APPLICATION — Senior Tailor                                 │
│  Submitted June 5, 2026                                      │
├──────────────────────┬───────────────────────────────────────┤
│  APPLICANT           │  STATUS                               │
│  Tunde Kareem        │  [NEW ▾]  ← status dropdown          │
│  tunde@gmail.com     │                                       │
│  +234 803 456 7890   │  ADMIN NOTES                         │
│  5+ years exp        │  [textarea — internal only]          │
│                      │  [Save notes]                        │
│  [PFA VERIFIED ✓]    │                                       │
│  PFA/2023/0142       │  SEND EMAIL                          │
│  Fashion Design · Y3 │  Subject: [________________]         │
│                      │  Body: [___________________]         │
│  University:         │        [___________________]         │
│  LASU                │  [SEND EMAIL →]                      │
├──────────────────────┴───────────────────────────────────────┤
│  COVER LETTER                                                │
│  [cover letter text]                                        │
├──────────────────────────────────────────────────────────────┤
│  DOCUMENTS                                                   │
│  [📄 Download CV]    [📄 Download Portfolio]                │
│  [📄 IT Letter]      [📄 School ID]  (PFA only)            │
├──────────────────────────────────────────────────────────────┤
│  CUSTOM FIELD RESPONSES                                      │
│  [field label]: [response]                                  │
│  [field label]: [response]                                  │
└──────────────────────────────────────────────────────────────┘
```

**Status change:**
When admin changes status:
- Updates `JobApplication.status`
- Optionally sends a status email to applicant:
  - Shortlisted: "Congratulations — you've been shortlisted"
  - Interviewed: "Interview invitation"
  - Rejected: "Thank you for applying"
  - Hired: "Welcome to Prudential Atelier"

**Email templates per status:**
Build branded email templates for each status change.

---

## SECTION 7 — SEED DEMO DATA

Add to `scripts/seed-demo.ts`:

```typescript
// 3 demo job postings
const jobs = [
  {
    title: 'Senior Tailor',
    department: 'Production',
    type: 'FULL_TIME',
    location: 'Lagos, Nigeria',
    description: 'We are looking for an experienced senior tailor...',
    requirements: '5+ years experience in luxury garment construction...',
    benefits: 'Competitive salary, staff accommodation available...',
    salaryRange: '₦150,000 – ₦250,000/month',
    isPublished: true,
    isPFAPosition: false,
    slug: 'senior-tailor',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
  {
    title: 'Head Beader',
    department: 'Production',
    type: 'FULL_TIME',
    location: 'Lagos, Nigeria',
    description: 'Lead our beading and embellishment team...',
    requirements: '7+ years experience in hand beading, crystal work...',
    isPublished: true,
    isPFAPosition: false,
    slug: 'head-beader',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    title: 'Industrial Training Placement — Fashion Production',
    department: 'Production',
    type: 'IT_PLACEMENT',
    location: 'Lagos, Nigeria',
    description: 'Prudential Atelier welcomes PFA students for Industrial Training...',
    requirements: 'Must be a registered PFA student eligible for IT placement...',
    isPublished: true,
    isPFAPosition: true,
    slug: 'it-placement-fashion-production',
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
  },
]
```

---

## SECTION 8 — FOOTER + NAVBAR LINKS

Add "Careers" to the footer under THE HOUSE column:
```
The Atelier
Ready-to-Wear
Bridal
Kids
Careers     ← add
Fashion Academy
Journal
```

Also add to the About page bottom CTA section as a secondary link.

---

## EXECUTION ORDER

1. Schema additions → `prisma db push`
2. Build `src/lib/pfa-verify.ts` abstraction layer
3. Build `src/lib/job-custom-fields.ts` type definitions
4. Build `/careers` public listing page
5. Build `/careers/[slug]` detail + application form
6. Build PFA verification UI component
7. Build custom fields renderer component
8. Build `POST /api/careers/[slug]/apply` route
9. Build `POST /api/careers/verify-pfa` route
10. Build `/admin/careers` job postings list
11. Build `/admin/careers/new` + `/admin/careers/[id]/edit` with custom field builder
12. Build `/admin/careers/applications` list
13. Build `/admin/careers/applications/[id]` detail view
14. Add email templates (confirmation, status change emails)
15. Add "Careers" to admin sidebar under new CAREERS section
16. Add "Careers" to footer footer links
17. Seed demo job postings
18. `pnpm exec tsc --noEmit` — must pass
19. Commit and push

---

## COMPLETION CHECKLIST

- [ ] Schema created and pushed to Neon
- [ ] `pfa-verify.ts` built with mock/api/db modes
- [ ] `/careers` shows published job listings
- [ ] Filter by job type works
- [ ] `/careers/[slug]` shows full job detail
- [ ] Application form submits correctly (no auth required)
- [ ] PFA reg number verification works (mock mode)
- [ ] PFA-specific fields show only for IT placement jobs
- [ ] CV upload works via Cloudinary
- [ ] Confirmation email sends to applicant
- [ ] Admin gets notification + email on new application
- [ ] `/admin/careers` lists all job postings
- [ ] Admin can create/edit job postings with TipTap editor
- [ ] Custom field builder works (all 12 field types)
- [ ] Custom fields render correctly on application form
- [ ] `/admin/careers/applications` lists all applications
- [ ] Admin can change application status
- [ ] Admin can send emails to applicants from detail page
- [ ] Admin can download CV and other uploaded documents
- [ ] PFA verified badge shows on PFA applications
- [ ] "Careers" link in footer
- [ ] "Careers" section in admin sidebar
- [ ] Demo job postings seeded (3 jobs including 1 IT placement)
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Careers + Job Applications + PFA IT System*
