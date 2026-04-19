import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { getProject, addSubToProject, removeSubFromProject } from '../api/projects';
import { listSubs, createSub } from '../api/subcontractors';
import Layout from '../components/Layout';
import ComplianceBadge from '../components/ComplianceBadge';

export default function ProjectDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showAddSub, setShowAddSub] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [newSubForm, setNewSubForm] = useState({ name: '', ein: '', email: '' });
  const [addMode, setAddMode] = useState('existing'); // existing | new

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id).then(r => r.data),
  });
  const { data: allSubs } = useQuery({
    queryKey: ['subs'],
    queryFn: () => listSubs().then(r => r.data),
  });

  const removeMut = useMutation({
    mutationFn: (subId) => removeSubFromProject(id, subId),
    onSuccess: () => { qc.invalidateQueries(['project', id]); toast.success('Subcontractor removed'); },
  });

  const addExistingMut = useMutation({
    mutationFn: () => addSubToProject(id, selectedSubId),
    onSuccess: () => { qc.invalidateQueries(['project', id]); setShowAddSub(false); setSelectedSubId(''); toast.success('Subcontractor added'); },
  });

  const createAndAddMut = useMutation({
    mutationFn: async () => {
      const res = await import('../api/subcontractors').then(m => m.createSub(newSubForm));
      await addSubToProject(id, res.data.id);
    },
    onSuccess: () => {
      qc.invalidateQueries(['project', id]);
      qc.invalidateQueries(['subs']);
      setShowAddSub(false);
      setNewSubForm({ name: '', ein: '', email: '' });
      toast.success('Subcontractor created and added');
    },
  });

  if (isLoading) return <Layout><div className="py-8 text-center text-gray-400">Loading...</div></Layout>;

  const projectSubIds = new Set((project?.subcontractors || []).map(s => s.id));
  const availableSubs = (allSubs || []).filter(s => !projectSubIds.has(s.id));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline">← Projects</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{project?.name}</h1>
          {project?.address && <p className="text-gray-500 text-sm">{project.address}</p>}
          <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{project?.status}</span>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Subcontractors ({project?.subcontractors?.length ?? 0})</h2>
            <button onClick={() => setShowAddSub(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700">
              + Add Sub
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {project?.subcontractors?.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/subcontractors/${sub.id}`} className="text-blue-600 hover:underline font-medium">{sub.name}</Link>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-800">{sub.compliance_score ?? 100}</td>
                  <td className="px-4 py-3"><ComplianceBadge score={sub.compliance_score ?? 100} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeMut.mutate(sub.id)} className="text-red-500 text-xs hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
              {!project?.subcontractors?.length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No subcontractors on this project yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Subcontractor</h2>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setAddMode('existing')} className={`flex-1 py-1.5 text-sm rounded border ${addMode === 'existing' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300'}`}>Existing</button>
              <button onClick={() => setAddMode('new')} className={`flex-1 py-1.5 text-sm rounded border ${addMode === 'new' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300'}`}>Create New</button>
            </div>
            {addMode === 'existing' ? (
              <select value={selectedSubId} onChange={e => setSelectedSubId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">Select subcontractor...</option>
                {availableSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <div className="space-y-2">
                <input placeholder="Company name *" value={newSubForm.name} onChange={e => setNewSubForm({...newSubForm, name: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" />
                <input placeholder="EIN (optional)" value={newSubForm.ein} onChange={e => setNewSubForm({...newSubForm, ein: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" />
                <input placeholder="Email (optional)" value={newSubForm.email} onChange={e => setNewSubForm({...newSubForm, email: e.target.value})} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => addMode === 'existing' ? addExistingMut.mutate() : createAndAddMut.mutate()}
                disabled={addMode === 'existing' ? !selectedSubId : !newSubForm.name}
                className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
              >Add</button>
              <button onClick={() => setShowAddSub(false)} className="flex-1 border rounded-md py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
