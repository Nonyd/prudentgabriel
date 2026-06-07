import type { JobType } from "@prisma/client";

export type CareerDemoJob = {
  title: string;
  department: string;
  type: JobType;
  location: string;
  description: string;
  requirements: string;
  benefits?: string;
  salaryRange?: string;
  isPublished: boolean;
  isPFAPosition: boolean;
  slug: string;
  deadlineDays: number;
};

export const DEMO_CAREER_JOBS: CareerDemoJob[] = [
  {
    title: "Senior Tailor",
    department: "Production",
    type: "FULL_TIME",
    location: "Lagos, Nigeria",
    description: `<p>We are looking for an experienced senior tailor to join our production team at Victoria Island. You will lead garment construction for bespoke commissions and selected ready-to-wear pieces — from first fitting through final hand finish.</p>
<p>This is a hands-on leadership role in a quiet, precision-focused atelier. You will work closely with our head cutter, beading team, and client consultants to deliver garments that meet Prudential's standard of excellence.</p>`,
    requirements: `<ul>
<li>5+ years experience in luxury garment construction</li>
<li>Expertise in hand finishing, pattern adjustment, and client fittings</li>
<li>Ability to mentor junior tailors and maintain production quality</li>
<li>Calm under deadline pressure; meticulous attention to detail</li>
</ul>`,
    benefits: `<ul>
<li>Competitive salary with performance reviews</li>
<li>Staff accommodation available for qualified candidates</li>
<li>Training in advanced construction techniques</li>
<li>Staff discount on atelier services</li>
</ul>`,
    salaryRange: "₦150,000 – ₦250,000/month",
    isPublished: true,
    isPFAPosition: false,
    slug: "senior-tailor",
    deadlineDays: 30,
  },
  {
    title: "Head Beader",
    department: "Production",
    type: "FULL_TIME",
    location: "Lagos, Nigeria",
    description: `<p>Lead our beading and embellishment studio — the room where bridal bodices, crystal appliqué, and hand-sewn pearls come to life. You will oversee design interpretation, quality control, and the training of junior beaders.</p>
<p>Our clients expect work that photographs beautifully and survives a full Lagos ceremony. You will set the standard for both.</p>`,
    requirements: `<ul>
<li>7+ years experience in hand beading, crystal work, and embellishment</li>
<li>Portfolio demonstrating bridal and occasion wear</li>
<li>Experience mentoring artisans in a production environment</li>
<li>Strong colour sense and pattern layout skills</li>
</ul>`,
    benefits: `<ul>
<li>Competitive salary</li>
<li>Creative autonomy within the Prudential design language</li>
<li>Premium materials and tools provided</li>
</ul>`,
    salaryRange: "₦180,000 – ₦280,000/month",
    isPublished: true,
    isPFAPosition: false,
    slug: "head-beader",
    deadlineDays: 30,
  },
  {
    title: "Client Relations Officer",
    department: "Client Services",
    type: "FULL_TIME",
    location: "Lagos, Nigeria",
    description: `<p>Be the first voice of Prudential Atelier for new enquiries — consultations, bespoke commissions, bridal appointments, and ready-to-wear styling. You will manage the front-of-house experience with warmth, discretion, and impeccable organisation.</p>
<p>This role suits someone who loves luxury hospitality and understands that every client interaction shapes trust in the house.</p>`,
    requirements: `<ul>
<li>2+ years in luxury retail, hospitality, or client-facing roles</li>
<li>Excellent written and spoken English; Yoruba or Igbo a plus</li>
<li>Comfort with CRM tools and appointment scheduling</li>
<li>Polished presentation and calm professionalism</li>
</ul>`,
    benefits: `<ul>
<li>Competitive salary plus client satisfaction bonus</li>
<li>Professional development in luxury client management</li>
<li>Staff uniform allowance</li>
</ul>`,
    salaryRange: "₦120,000 – ₦180,000/month",
    isPublished: true,
    isPFAPosition: false,
    slug: "client-relations-officer",
    deadlineDays: 45,
  },
  {
    title: "Freelance Pattern Cutter",
    department: "Production",
    type: "FREELANCE",
    location: "Lagos, Nigeria (on-site)",
    description: `<p>We engage experienced pattern cutters on a project basis for bespoke and bridal commissions. Work includes block development, toile preparation, and pattern adjustments from fitting sessions.</p>
<p>Ideal for a senior cutter who prefers flexible engagement while working within a established luxury atelier.</p>`,
    requirements: `<ul>
<li>Demonstrable experience in women's wear pattern cutting</li>
<li>Ability to work from sketches, reference images, and client measurements</li>
<li>Own tools preferred; studio space provided on-site</li>
<li>Available for 2–4 day blocks during peak season</li>
</ul>`,
    benefits: `<p>Project-based rates negotiated per commission. Priority access to ongoing freelance work for reliable cutters.</p>`,
    salaryRange: "Project rates — enquire within",
    isPublished: true,
    isPFAPosition: false,
    slug: "freelance-pattern-cutter",
    deadlineDays: 60,
  },
  {
    title: "Production Intern",
    department: "Production",
    type: "INTERNSHIP",
    location: "Lagos, Nigeria",
    description: `<p>A three-month paid internship for early-career fashion graduates who want real exposure to luxury production — cutting room etiquette, hand finishing, quality checks, and atelier workflow.</p>
<p>You will rotate across departments under senior supervision. This is not a desk role; expect to learn by doing.</p>`,
    requirements: `<ul>
<li>Recent graduate or final-year student in fashion design or related field</li>
<li>Basic sewing skills and willingness to learn hand techniques</li>
<li>Punctual, respectful, and eager to absorb atelier standards</li>
<li>Portfolio or school project samples required</li>
</ul>`,
    benefits: `<ul>
<li>Monthly stipend</li>
<li>Mentorship from senior artisans</li>
<li>Certificate of completion</li>
<li>Consideration for full-time roles when available</li>
</ul>`,
    salaryRange: "₦80,000/month stipend",
    isPublished: true,
    isPFAPosition: false,
    slug: "production-intern",
    deadlineDays: 21,
  },
  {
    title: "Industrial Training Placement — Fashion Production",
    department: "Production",
    type: "IT_PLACEMENT",
    location: "Lagos, Nigeria",
    description: `<p>Prudential Atelier welcomes Prudential Fashion Academy (PFA) students for Industrial Training. Spend your IT period inside a working luxury atelier — from fabric preparation and cutting support to finishing and quality control.</p>
<p>This placement is designed for students who are serious about production craft, not just design sketching. You will document your learning and receive structured feedback from department leads.</p>`,
    requirements: `<ul>
<li>Must be a registered PFA student eligible for IT placement</li>
<li>Valid school IT letter and student ID required at application</li>
<li>PFA registration number will be verified before acceptance</li>
<li>Minimum 3-month placement; 6-month preferred</li>
</ul>`,
    benefits: `<ul>
<li>Hands-on experience in a live luxury production environment</li>
<li>Mentorship from senior tailors and cutters</li>
<li>IT completion letter and reference on successful completion</li>
</ul>`,
    isPublished: true,
    isPFAPosition: true,
    slug: "it-placement-fashion-production",
    deadlineDays: 60,
  },
];
