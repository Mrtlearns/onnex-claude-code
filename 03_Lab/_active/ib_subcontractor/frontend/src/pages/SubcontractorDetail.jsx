import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSub, syncOsha, getViolations, getCerts } from '../api/subcontractors';
import { uploadCert, deleteCert } from '../api/certifications';
import Layout from '../components/Layout';
import ComplianceBadge from '../components/ComplianceBadge';
import ViolationList from '../components/ViolationList';
import CertCard from '../components/CertCard';

const CERT_TYPES = ['OSHA 10', 'OSHA 30', 'First Aid/CPR', 'Crane Operator', 'Forklift', 'Rigging', 'Confined Space', 'Fall Protection', 'Scaffold', 'Electrical', 'Other'];

export default function SubcontractorDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [certType, setCertType] = useState('');
  const [certFile, setCertFile] = useState(null);

  const { data: sub } = useQuery({ queryKey: ['sub', id], queryFn: () => getSub(id).then(r => r.data) });
  const { data: violations } = useQuery({ queryKey: ['violations', id], queryFn: () => getViolations(id).then(r => r.data) });
  const { data: certs } = useQuery({ queryKey: ['certs', id], queryFn: () => getCerts(id).then(r => r.data) });

  const syncMut = useMutation({
    mutationFn: () => syncOsha(id),
    onSuccess: () => toast.success('OSHA sync queued — check back in a minute'),
  });

  const uploadMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('sub_id', id);
      fd.append('cert_type', certType);
      fd.append('file', certFile);
      return uploadCert(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(['certs', id]);
      qc.invalidateQueries(['sub', id]);
      setShowUpload(false);
      setCertType('');
      setCertFile(null);
      toast.success('Certificate uploaded');
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteCert,
    onSuccess: () => { qc.invalidateQueries(['certs', id]); toast.success('Certificate deleted'); },
  });

  const score = sub?.compliance_score ?? 100;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline">← Projects</Link>
          <div className="flex items-start justify-between mt-1">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{sub?.name ?? '—'}</h1>
              <div className="text-sm text-gray-500 space-x-3 mt-0.5">
                {sub?.ein && <span>EIN: {sub.ein}</span>}
                {sub?.email && <span>{sub.email}</span>}
                {sub?.phone && <span>{sub.phone}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-extrabold text-gray-900">{score}</div>
              <ComplianceBadge score={score} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {syncMut.isPending ? 'Queuing...' : '⟳ Sync OSHA'}
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            + Upload Certificate
          </button>
          <Link
            to={`/portal/${id}`}
            target="_blank"
            className="border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            ↗ Sub Portal Link
          </Link>
        </div>

        {/* Content grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Certifications */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Certifications ({certs?.length ?? 0})</h2>
            {certs?.length ? (
              <div className="space-y-2">
                {certs.map(c => <CertCard key={c.id} cert={c} onDelete={() => deleteMut.mutate(c.id)} />)}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No certifications uploaded yet.</p>
            )}
          </div>

          {/* OSHA Violations */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">OSHA Violations ({violations?.length ?? 0})</h2>
            {sub?.last_osha_check && (
              <p className="text-xs text-gray-400 mb-2">Last synced: {new Date(sub.last_osha_check).toLocaleDateString()}</p>
            )}
            <ViolationList violations={violations ?? []} />
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Upload Certificate</h2>
            <div className="space-y-3">
              <select value={certType} onChange={e => setCertType(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">Select certification type...</option>
                {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setCertFile(e.target.files[0])}
                className="w-full text-sm text-gray-600"
              />
              {certFile && <p className="text-xs text-gray-400">Selected: {certFile.name}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => uploadMut.mutate()}
                disabled={!certType || !certFile || uploadMut.isPending}
                className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
              >
                {uploadMut.isPending ? 'Uploading...' : 'Upload'}
              </button>
              <button onClick={() => setShowUpload(false)} className="flex-1 border rounded-md py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
