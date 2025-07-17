// components/FileUploader.tsx
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function FileUploader() {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <div style={{ border: '2px dashed #999', padding: 20, borderRadius: 8 }}>
      <div {...getRootProps()} style={{ cursor: 'pointer', padding: 10, background: isDragActive ? '#eef' : '#fafafa' }}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Lasă fișierele aici...</p>
        ) : (
          <p>Trage fișiere aici sau apasă pentru a selecta</p>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h4>Fișiere încărcate:</h4>
          <ul>
            {files.map((file, index) => (
              <li key={index}>{file.name} ({Math.round(file.size / 1024)} KB)</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
