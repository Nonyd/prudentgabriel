import { cmsBool, cmsGet, getCMSContent } from "@/lib/cms";
import { getHomepageTestimonials } from "@/lib/testimonials";
import { HomeTestimonialsCarousel } from "@/components/home/HomeTestimonialsCarousel";

const CMS_KEYS = [
  "home_testimonials_enabled",
  "home_testimonials_heading",
  "home_testimonials_subtitle",
] as const;

export async function HomeTestimonialsSection() {
  const [cms, items] = await Promise.all([getCMSContent([...CMS_KEYS]), getHomepageTestimonials(6)]);

  const enabled = cmsBool(cms, "home_testimonials_enabled", true);
  if (!enabled || items.length === 0) return null;

  const heading = cmsGet(cms, "home_testimonials_heading", "From the atelier");
  const subtitle = cmsGet(cms, "home_testimonials_subtitle", "").trim();

  return <HomeTestimonialsCarousel items={items} heading={heading} subtitle={subtitle || undefined} />;
}
