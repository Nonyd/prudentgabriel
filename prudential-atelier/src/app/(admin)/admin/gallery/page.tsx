import { GalleryManager } from "@/components/admin/GalleryManager";

export default function AdminGalleryPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-black">Gallery</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Manage Atelier and Prudential Bride gallery images.</p>
      <GalleryManager />
    </div>
  );
}
