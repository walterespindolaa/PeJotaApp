import { Link } from "react-router-dom";

export default function Footer() {
  const ano = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/40 py-6 mt-8">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© {ano} Atlas</p>
        <nav className="flex items-center gap-4">
          <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">
            Termos de Uso
          </Link>
          <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">
            Política de Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
