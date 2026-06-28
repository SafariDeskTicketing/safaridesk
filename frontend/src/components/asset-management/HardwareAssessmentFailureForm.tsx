import React, { useState } from 'react';

interface HardwareAssessmentFailureFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
}

const ISSUE_CHECKLIST_OPTIONS = [
  'No Power',
  'Blue Screen',
  'System Board Error',
  'Disk Error',
  'Memory Error',
  'Broken Port',
  'Damaged Case',
  'Cracked Screen',
  'No Display',
  'Keyboard Issues',
  'Touchpad Not Working',
  'Will Not Charge / Battery Issue',
  'Overheating',
  'Network Adapter Failure',
  'USB Port Not Detecting',
  'Fan Noise / Cooling Issues',
  'Other',
];

const HardwareAssessmentFailureForm: React.FC<HardwareAssessmentFailureFormProps> = ({ onSubmit, initialData }) => {
  const [formData, setFormData] = useState(initialData || {
    device_serial_number: '',
    technician_name: '',
    assessment_date: new Date().toISOString().split('T')[0], // Auto-populate with current date
    issue_checklist: [],
    other_issue_description: '',
    description_notes: '',
    photo_attachments: [], // This will store URLs or base64 strings for simplicity in prototype
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prevData: any) => ({
      ...prevData,
      issue_checklist: checked
        ? [...prevData.issue_checklist, value]
        : prevData.issue_checklist.filter((issue: string) => issue !== value),
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // For simplicity, convert to base64 or store file objects for later upload
      // In a real app, you'd upload these to a storage service and store URLs
      const newAttachments: string[] = [];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newAttachments.push(reader.result as string);
          if (newAttachments.length === files.length) {
            setFormData((prevData: any) => ({
              ...prevData,
              photo_attachments: [...prevData.photo_attachments, ...newAttachments],
            }));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Device Serial Number:</label>
        <input type="text" name="device_serial_number" value={formData.device_serial_number} onChange={handleChange} required />
      </div>
      <div>
        <label>Technician Name:</label>
        <input type="text" name="technician_name" value={formData.technician_name} onChange={handleChange} required />
      </div>
      <div>
        <label>Assessment Date:</label>
        <input type="date" name="assessment_date" value={formData.assessment_date} onChange={handleChange} readOnly />
      </div>
      <div>
        <h3>Issue Checklist:</h3>
        {ISSUE_CHECKLIST_OPTIONS.map((issue) => (
          <div key={issue}>
            <input
              type="checkbox"
              id={issue}
              name="issue_checklist"
              value={issue}
              checked={formData.issue_checklist.includes(issue)}
              onChange={handleCheckboxChange}
            />
            <label htmlFor={issue}>{issue}</label>
          </div>
        ))}
      </div>
      {formData.issue_checklist.includes('Other') && (
        <div>
          <label>Other Issue Description:</label>
          <textarea
            name="other_issue_description"
            value={formData.other_issue_description}
            onChange={handleChange}
            rows={3}
          />
        </div>
      )}
      <div>
        <label>Description/Notes:</label>
        <textarea name="description_notes" value={formData.description_notes} onChange={handleChange} rows={5} />
      </div>
      <div>
        <label>Photo Upload (Optional):</label>
        <input type="file" multiple onChange={handlePhotoUpload} accept="image/*" />
        {formData.photo_attachments.map((photo: string, index: number) => (
          <img key={index} src={photo} alt="Hardware Issue" style={{ width: '100px', height: '100px', margin: '6px' }} />
        ))}
      </div>
      <button type="submit">Submit Assessment</button>
    </form>
  );
};

export default HardwareAssessmentFailureForm;