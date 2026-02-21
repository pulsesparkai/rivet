import { Nav } from './nav';
import { Footer } from './footer';

export function PageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="pt-28 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-3">{title}</h1>
            {description && <p className="text-lg text-gray-400">{description}</p>}
          </div>
          <div className="prose prose-invert prose-gray max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-400 prose-p:leading-relaxed
            prose-a:text-brand-400 prose-a:no-underline hover:prose-a:text-brand-300
            prose-code:text-brand-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800
            prose-li:text-gray-400
            prose-strong:text-gray-200
          ">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
