import { useState } from 'react';
import { sendEmail } from '../services/emailService';
import { Mail, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function EmailForm() {
    const [formData, setFormData] = useState({ to: '', subject: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', text: '' });
    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formData.to) newErrors.to = 'Email is required';
        else if (!emailRegex.test(formData.to)) newErrors.to = 'Invalid email address';

        if (!formData.subject) newErrors.subject = 'Subject is required';
        else if (formData.subject.length < 3) newErrors.subject = 'Too short (min 3 chars)';

        if (!formData.message) newErrors.message = 'Message is required';
        else if (formData.message.length < 5) newErrors.message = 'Too short (min 5 chars)';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', text: '' });

        if (!validate()) return;

        setLoading(true);
        try {
            const result = await sendEmail(formData);
            if (result.success) {
                setStatus({ type: 'success', text: result.message });
                setFormData({ to: '', subject: '', message: '' });
            }
        } catch (err) {
            setStatus({ 
                type: 'error', 
                text: err.message || 'Something went wrong. Please try again.' 
            });
            if (err.errors) {
                const apiErrors = {};
                err.errors.forEach(e => apiErrors[e.field] = e.message);
                setErrors(apiErrors);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md w-full mx-auto p-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-blue-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <Mail className="w-8 h-8" />
                        <h2 className="text-2xl font-bold">Email Module</h2>
                    </div>
                    <p className="text-blue-100 text-sm">Send professional emails securely</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {status.type && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                            status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                            <span className="text-sm font-medium">{status.text}</span>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Recipient Email</label>
                        <input
                            type="email"
                            name="to"
                            value={formData.to}
                            onChange={handleChange}
                            placeholder="user@example.com"
                            className={`w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 ${
                                errors.to ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                            }`}
                        />
                        {errors.to && <p className="text-xs text-red-500 mt-1 ml-1">{errors.to}</p>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Subject</label>
                        <input
                            type="text"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            placeholder="Support Request"
                            className={`w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 ${
                                errors.subject ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                            }`}
                        />
                        {errors.subject && <p className="text-xs text-red-500 mt-1 ml-1">{errors.subject}</p>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Message</label>
                        <textarea
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            rows="4"
                            placeholder="Write your message here..."
                            className={`w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 resize-none ${
                                errors.message ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                            }`}
                        ></textarea>
                        {errors.message && <p className="text-xs text-red-500 mt-1 ml-1">{errors.message}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-gray-400 disabled:scale-100 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Sending...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                <span>Send Email</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
