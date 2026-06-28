export default function Footer() {
  return (
    <footer className="mt-auto py-4 text-center text-sm text-gray-500 dark:text-gray-400">
      © {new Date().getFullYear()} VETAPP — Plataforma de gestão veterinária.
    </footer>
  );
}
