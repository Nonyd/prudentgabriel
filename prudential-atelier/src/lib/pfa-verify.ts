export interface PFAStudentInfo {
  valid: boolean;
  regNumber?: string;
  name?: string;
  course?: string;
  year?: number;
  graduationYear?: number;
  isEligibleForIT?: boolean;
  error?: string;
}

export async function verifyPFAStudent(regNumber: string): Promise<PFAStudentInfo> {
  const method = process.env.PFA_VERIFY_METHOD || "mock";
  const normalized = regNumber.trim().toUpperCase();

  if (method === "api") {
    try {
      const res = await fetch(
        `${process.env.PFA_API_URL}/api/verify-student?regNumber=${encodeURIComponent(normalized)}`,
        {
          headers: { Authorization: `Bearer ${process.env.PFA_API_KEY}` },
        },
      );
      if (!res.ok) return { valid: false, error: "Student not found" };
      return (await res.json()) as PFAStudentInfo;
    } catch {
      return { valid: false, error: "Verification service unavailable" };
    }
  }

  if (method === "db") {
    return { valid: false, error: "DB method not yet configured" };
  }

  const pfaRegPattern = /^PFA\/\d{4}\/\d{3,4}$/;
  if (!pfaRegPattern.test(normalized)) {
    return {
      valid: false,
      error: "Invalid registration number format. Expected: PFA/YYYY/NNNN",
    };
  }

  return {
    valid: true,
    regNumber: normalized,
    name: "Demo PFA Student",
    course: "Fashion Design & Technology",
    year: 3,
    graduationYear: 2026,
    isEligibleForIT: true,
  };
}
