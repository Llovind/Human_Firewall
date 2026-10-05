import { notFound } from 'next/navigation';
import Gallery from './Gallery';

/** Designer-facing gallery of the shared parts. Only exists in development; production returns 404. */
export default function ComponentGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery />;
}
