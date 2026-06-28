import React, { useState, useEffect } from 'react';
import { Edit, Plus, Save, ChevronDown, Trash2, Pencil } from 'lucide-react';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { Modal } from '../ui/Modal';
import { Loader } from '../loader/loader';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import Button from '../ui/Button';
import Select from '../ui/Select';

interface Template {
  id: number;
  name: string;
  description: string;
  subject: string;
  body: string;
  is_active: boolean;
  type: string;
}

interface Category {
  id: number;
  name: string;
  templates: Template[];
}

const TEMPLATE_TYPES = ['ticket', 'task', 'request', 'sla', 'comment', 'csat'];

export const EmailTemplates: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Category modal (view/edit templates)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Add/rename category modal
  const [categoryModalMode, setCategoryModalMode] = useState<'add' | 'rename' | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryNameError, setCategoryNameError] = useState('');

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'category' | 'template'; id: number; name: string } | null>(null);

  // Template editing
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', type: 'ticket', subject: '', body: '' });

  // Placeholders sidebar
  const [placeholders, setPlaceholders] = useState<Record<string, string[]>>({});
  const [isPlaceholdersLoading, setIsPlaceholdersLoading] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>('ticket');
  const [activeInput, setActiveInput] = useState<'subject' | 'body' | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);

  useEffect(() => {
    http.get(APIS.LOAD_EMAIL_TEMPLATES)
      .then((res) => setCategories(res.data.results))
      .catch((err) => console.error('Error fetching email templates:', err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isCategoryModalOpen) return;
    setIsPlaceholdersLoading(true);
    http.get(APIS.LOAD_EMAIL_PLACEHOLDERS)
      .then((res) => setPlaceholders(res.data))
      .catch((err) => console.error('Error fetching placeholders:', err))
      .finally(() => setIsPlaceholdersLoading(false));
  }, [isCategoryModalOpen]);

  // ── Category CRUD ────────────────────────────────────────────────

  const openCategoryModal = (category: Category) => {
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
    setIsModalLoading(true);
    setIsAddingTemplate(false);
    setEditingTemplate(null);
    setTimeout(() => setIsModalLoading(false), 300);
  };

  const openAddCategory = () => {
    setCategoryNameInput('');
    setCategoryNameError('');
    setCategoryModalMode('add');
  };

  const openRenameCategory = (e: React.MouseEvent, category: Category) => {
    e.stopPropagation();
    setCategoryNameInput(category.name);
    setCategoryNameError('');
    setSelectedCategory(category);
    setCategoryModalMode('rename');
  };

  const handleSaveCategory = async () => {
    const name = categoryNameInput.trim();
    if (!name) { setCategoryNameError('Name cannot be empty.'); return; }
    const duplicate = categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== selectedCategory?.id
    );
    if (duplicate) { setCategoryNameError('Category name already exists.'); return; }

    try {
      if (categoryModalMode === 'add') {
        const res = await http.post(APIS.LOAD_EMAIL_TEMPLATES, { name });
        setCategories((prev) => [...prev, { ...res.data, templates: [] }]);
      } else if (categoryModalMode === 'rename' && selectedCategory) {
        await http.put(`${APIS.LOAD_EMAIL_TEMPLATES}${selectedCategory.id}/`, { name });
        setCategories((prev) => prev.map((c) => c.id === selectedCategory.id ? { ...c, name } : c));
        setSelectedCategory((prev) => prev ? { ...prev, name } : prev);
      }
      setCategoryModalMode(null);
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await http.delete(`${APIS.LOAD_EMAIL_TEMPLATES}${id}/`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (selectedCategory?.id === id) {
        setIsCategoryModalOpen(false);
        setSelectedCategory(null);
      }
    } catch (err) {
      console.error('Error deleting category:', err);
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── Template CRUD ────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editingTemplate || !selectedCategory) return;
    try {
      await http.put(`${APIS.UPDATE_EMAIL_TEMPLATE}${editingTemplate.id}/`, {
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
        description: editingTemplate.description || '',
        is_active: editingTemplate.is_active,
      });
      const updatedTemplates = selectedCategory.templates.map((t) =>
        t.id === editingTemplate.id ? editingTemplate : t
      );
      const updatedCategory = { ...selectedCategory, templates: updatedTemplates };
      setSelectedCategory(updatedCategory);
      setCategories((prev) => prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c)));
      setEditingTemplate(null);
    } catch (err) {
      console.error('Error updating template:', err);
    }
  };

  const handleCreateTemplate = async () => {
    if (!selectedCategory || !newTemplate.name || !newTemplate.subject || !newTemplate.body) return;
    try {
      const res = await http.post(APIS.UPDATE_EMAIL_TEMPLATE, {
        name: newTemplate.name,
        type: newTemplate.type,
        subject: newTemplate.subject,
        body: newTemplate.body,
        description: '',
        is_active: true,
        category: selectedCategory.id,
      });
      const created: Template = res.data;
      const updatedCategory = { ...selectedCategory, templates: [...selectedCategory.templates, created] };
      setSelectedCategory(updatedCategory);
      setCategories((prev) => prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c)));
      setNewTemplate({ name: '', type: 'ticket', subject: '', body: '' });
      setIsAddingTemplate(false);
    } catch (err) {
      console.error('Error creating template:', err);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!selectedCategory) return;
    try {
      await http.delete(`${APIS.UPDATE_EMAIL_TEMPLATE}${id}/`);
      const updatedCategory = { ...selectedCategory, templates: selectedCategory.templates.filter((t) => t.id !== id) };
      setSelectedCategory(updatedCategory);
      setCategories((prev) => prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c)));
    } catch (err) {
      console.error('Error deleting template:', err);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleVariableClick = (variable: string) => {
    if (editingTemplate && activeInput) {
      const inputElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      const start = cursorPosition;
      const text =
        editingTemplate[activeInput].substring(0, start) +
        variable +
        editingTemplate[activeInput].substring(start);
      setEditingTemplate({ ...editingTemplate, [activeInput]: text });
      setTimeout(() => {
        inputElement.selectionStart = inputElement.selectionEnd = start + variable.length;
        inputElement.focus();
      }, 0);
    }
  };

  if (isLoading) return <Loader />;

  return (
    <div className="text-sm space-y-3 px-3 py-2">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-[var(--border-color)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">Email Template Categories</h3>
          <button
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center space-x-2"
            onClick={openAddCategory}
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>

        <div className="space-y-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="border border-gray-200 dark:border-[var(--border-color)] rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover"
              onClick={() => openCategoryModal(category)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{category.name}</h4>
                  <p className="text-sm text-gray-500">{category.templates.length} templates</p>
                </div>
                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                    title="Rename category"
                    onClick={(e) => openRenameCategory(e, category)}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    title="Delete category"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'category', id: category.id, name: category.name }); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Rename Category Modal */}
      <Modal
        isOpen={categoryModalMode !== null}
        onClose={() => setCategoryModalMode(null)}
        title={categoryModalMode === 'add' ? 'Add Category' : 'Rename Category'}
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            value={categoryNameInput}
            onChange={(e) => { setCategoryNameInput(e.target.value); setCategoryNameError(''); }}
            error={categoryNameError}
            fullWidth
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setCategoryModalMode(null)}>Cancel</Button>
            <Button onClick={handleSaveCategory}>{categoryModalMode === 'add' ? 'Create' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[var(--text-primary)]">
            Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
            {confirmDelete?.type === 'category' && ' This will also delete all templates inside it.'}
          </p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.type === 'category') handleDeleteCategory(confirmDelete.id);
                else handleDeleteTemplate(confirmDelete.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Category Templates Modal */}
      {selectedCategory && (
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => { setIsCategoryModalOpen(false); setEditingTemplate(null); setIsAddingTemplate(false); }}
          title={selectedCategory.name}
          size="4xl"
        >
          {isModalLoading ? (
            <ModalSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">

                {/* Add Template form */}
                {isAddingTemplate ? (
                  <div className="border border-gray-200 dark:border-[var(--border-color)] rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-[var(--text-primary)]">New Template</h4>
                    <Input
                      label="Name"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      fullWidth
                    />
                    <Select
                      label="Type"
                      value={newTemplate.type}
                      onChange={(value) => setNewTemplate({ ...newTemplate, type: value })}
                      options={TEMPLATE_TYPES.map((type) => ({
                        value: type,
                        label: type.charAt(0).toUpperCase() + type.slice(1),
                      }))}
                    />
                    <Input
                      label="Subject"
                      value={newTemplate.subject}
                      onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                      onFocus={() => setActiveInput('subject')}
                      fullWidth
                    />
                    <Textarea
                      label="Body"
                      value={newTemplate.body}
                      onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                      onFocus={() => setActiveInput('body')}
                      rows={6}
                      fullWidth
                    />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => { setIsAddingTemplate(false); setNewTemplate({ name: '', type: 'ticket', subject: '', body: '' }); }}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTemplate}>
                        <Save className="w-4 h-4 mr-2" />
                        Create
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      className="bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 flex items-center space-x-1 text-sm"
                      onClick={() => setIsAddingTemplate(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Template</span>
                    </button>
                  </div>
                )}

                {/* Templates grouped by type */}
                {Object.entries(
                  selectedCategory.templates.reduce((acc, t) => {
                    if (!acc[t.type]) acc[t.type] = [];
                    acc[t.type].push(t);
                    return acc;
                  }, {} as Record<string, Template[]>)
                ).map(([type, templates]) => (
                  <div key={type} className="border border-gray-200 dark:border-[var(--border-color)] rounded-lg">
                    <button
                      className="w-full flex items-center justify-between p-4 text-left font-medium text-gray-900 dark:text-[var(--text-primary)]"
                      onClick={() => setOpenAccordion(openAccordion === type ? null : type)}
                    >
                      <span className="capitalize">{type} Templates</span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${openAccordion === type ? 'rotate-180' : ''}`} />
                    </button>

                    {openAccordion === type && (
                      <div className="p-4 border-t border-gray-200 dark:border-[var(--border-color)] space-y-4">
                        {templates.map((template) => (
                          <div key={template.id} className="border border-gray-200 dark:border-[var(--border-color)] rounded-lg p-4">
                            {editingTemplate?.id === template.id ? (
                              <div className="space-y-4">
                                <Input
                                  label="Subject"
                                  value={editingTemplate.subject}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                  onFocus={() => setActiveInput('subject')}
                                  onBlur={(e) => setCursorPosition(e.target.selectionStart || 0)}
                                  fullWidth
                                />
                                <Textarea
                                  label="Body"
                                  value={editingTemplate.body}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                                  onFocus={() => setActiveInput('body')}
                                  onBlur={(e) => setCursorPosition(e.target.selectionStart || 0)}
                                  rows={6}
                                  fullWidth
                                />
                                <div className="flex justify-end space-x-2">
                                  <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                                  <Button onClick={handleSaveEdit}>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{template.name}</h4>
                                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)] truncate">{template.subject}</p>
                                  {template.description && (
                                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 ml-3 shrink-0">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${template.is_active ? 'bg-primary-100 dark:bg-primary-800 text-primary-800 dark:text-primary-200' : 'bg-gray-100 dark:bg-surface-hover text-gray-800 dark:text-[var(--text-primary)]'}`}>
                                    {template.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                  <button
                                    className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                                    onClick={() => setEditingTemplate({ ...template })}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="text-gray-400 hover:text-red-600"
                                    onClick={() => setConfirmDelete({ type: 'template', id: template.id, name: template.name })}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Variables sidebar */}
              <div className="md:col-span-1">
                <div className="sticky top-0 bg-white dark:bg-surface-elevated rounded-lg shadow-sm border border-gray-200 dark:border-[var(--border-color)] p-6">
                  <h4 className="font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">Supported Variables</h4>
                  <div className="max-h-[800px] overflow-y-auto pr-2">
                    {isPlaceholdersLoading ? (
                      <VariablesSkeleton />
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(placeholders).map(([group, vars]) => {
                          const isEnabled =
                            (editingTemplate && editingTemplate.type === group.toLowerCase()) ||
                            (!editingTemplate && openAccordion === group.toLowerCase()) ||
                            (editingTemplate && editingTemplate.type === 'task' && group.toLowerCase() === 'tasks') ||
                            (!editingTemplate && openAccordion === 'task' && group.toLowerCase() === 'tasks');
                          return (
                            <div key={group}>
                              <h5 className="font-medium text-sm text-gray-700 dark:text-[var(--text-primary)] mb-2 capitalize">{group}</h5>
                              <div className="flex flex-wrap gap-2">
                                {vars.map((variable) => {
                                  const full = `{{${variable}}}`;
                                  return (
                                    <span
                                      key={variable}
                                      className={`px-2 py-1 rounded-md text-xs ${isEnabled ? 'bg-gray-100 dark:bg-surface-hover text-gray-800 dark:text-[var(--text-primary)] cursor-pointer hover:bg-gray-200' : 'bg-gray-200 dark:bg-surface-hover text-gray-500 cursor-not-allowed'}`}
                                      onClick={() => isEnabled && handleVariableClick(full)}
                                    >
                                      {full}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

const VariablesSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[...Array(5)].map((_, i) => (
      <div key={i}>
        <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/3 mb-2"></div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-20 bg-gray-200 dark:bg-surface-hover rounded-md"></div>
          <div className="h-6 w-24 bg-gray-200 dark:bg-surface-hover rounded-md"></div>
          <div className="h-6 w-16 bg-gray-200 dark:bg-surface-hover rounded-md"></div>
        </div>
      </div>
    ))}
  </div>
);

const ModalSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="md:col-span-2 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border border-gray-200 dark:border-[var(--border-color)] rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-surface-hover rounded w-1/2"></div>
        </div>
      ))}
    </div>
    <div className="md:col-span-1">
      <div className="sticky top-0 bg-white dark:bg-surface-elevated rounded-lg shadow-sm border border-gray-200 dark:border-[var(--border-color)] p-6 animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-surface-hover rounded w-1/2 mb-4"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/3 mb-2"></div>
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-20 bg-gray-200 dark:bg-surface-hover rounded-md"></div>
                <div className="h-6 w-24 bg-gray-200 dark:bg-surface-hover rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
