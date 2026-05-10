// components/FileUploader.tsx
'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onFilesChange: (files: any[]) => void;
  onUploadComplete?: (fileData: any) => void;
}

export default function FileUploader({ onFilesChange, onUploadComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const newFile = {
          ...data,
          id: Date.now(),
        };

        const updatedFiles = [...uploadedFiles, newFile];
        setUploadedFiles(updatedFiles);
        onFilesChange(updatedFiles);
        
        if (onUploadComplete) {
          onUploadComplete(newFile);
        }
      } else {
        alert(`Upload gagal: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Terjadi kesalahan saat mengupload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]); // Upload satu per satu untuk sekarang
    }
  }, [uploadedFiles]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (id: number) => {
    const updated = uploadedFiles.filter(f => f.id !== id);
    setUploadedFiles(updated);
    onFilesChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`file-upload-zone border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/5' 
            : 'border-zinc-700 hover:border-zinc-600'
          }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
          <Upload className="w-6 h-6 text-zinc-400" />
        </div>
        
        <p className="font-medium text-white mb-1">
          Drop file di sini atau klik untuk upload
        </p>
        <p className="text-xs text-zinc-500">
          Gambar, kode, dokumen (max 20MB)
        </p>

        <input
          id="file-input"
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>

      {/* Loading State */}
      {isUploading && (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Mengupload file...
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">UPLOADED FILES</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 group"
              >
                <div className="text-zinc-400">
                  {file.isImage ? (
                    <ImageIcon className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  onClick={() => removeFile(file.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
                  }
