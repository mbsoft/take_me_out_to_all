import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-6">
        Have questions, feedback, or suggestions? We&apos;d love to hear from you.
      </p>
      <a
        href="mailto:jwelch@mbsoft.com"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Mail className="h-4 w-4" />
        jwelch@mbsoft.com
      </a>
    </div>
  );
}
