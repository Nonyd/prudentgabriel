import { redirect } from "next/navigation";

export default function RTWProductRedirect({ params }: { params: { slug: string } }) {
  redirect(`/shop/${params.slug}`);
}
