import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import { getCerts } from '../api/subcontractors';
import { uploadCert } from '../api/certifications';
import CertCard from '../components/CertCard';

const CERT_TYPES = ['OSHA 10', 'OSHA 30', 'First Aid/CPR', 'Crane Operator', 'Forklift', 'Rigging', 'Confined Space', 'Fall Protection', 'Scaffold', 'Electrical', 'Other'];

export default function CertPortal() {
  const { token } = useParams(); // token = sub_id for MVP
  const qc = useQueryClient();
  const [certType, setCertType] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: certs, refetch } = useQuery({
    queryKey: ['portal-certs', token],
    queryFn: () => getCerts(token).then(r => r.data),
    retry: 1,
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!certType || !certFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('sub_id', token);
      fd.append('cert_type', certType);
      fd.append('file', certFile);
      await uploadCert(fd);
      toast.success('Certificate uploaded successfully!');
      setCertType('');
      setCertFile(null);
      refetch();
    } catch {
      // error handled by axios interceptor
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <Toaster position="top-right" />
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Prequal</h1>
          <p className="text-gray-500 text-sm mt-1">Subcontractor certification portal</p>
        </div>

        {/* Upload card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Upload a Certificate</h2>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certification Type</label>
              <select
                required
                value={certType}
                onChange={e => setCertType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type...</option>
                {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certificate File (PDF, JPG, PNG)</label>
              <input
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setCertFile(e.target.files[0])}
                className="w-full text-sm text-gray-600"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-blue-600 text-white rounded-md py-2 font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Certificate'}
            </button>
          </form>
        </div>

        {/* Current certs */}
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">Your Certifications ({certs?.length ?? 0})</h2>
          {certs?.length ? (
            <div className="space-y-2">{certs.map(c => <CertCard key={c.id} cert={c} />)}</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-400 text-sm">
              No certifications on file yet. Upload your first one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
