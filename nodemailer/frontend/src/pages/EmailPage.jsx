import EmailForm from '../components/EmailForm';

export default function EmailPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <header className="mb-8 text-center max-w-lg">
                <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                    Enterprise Communication
                </h1>
                <p className="mt-3 text-lg text-gray-500">
                    Connect with your users instantly using our secure mailing module.
                </p>
            </header>
            
            <EmailForm />
            
            <footer className="mt-12 text-sm text-gray-400">
                &copy; 2026 Periyar University ERP • Communication Module
            </footer>
        </div>
    );
}
