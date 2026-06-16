import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, 
  Users, 
  UserCheck, 
  GraduationCap, 
  MapPin, 
  BookOpen, 
  Search, 
  Activity,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X 
} from 'lucide-react';

// Fungsi untuk memproses teks CSV
const parseCSV = (str) => {
  const lines = str.split(/\r?\n/);
  let headerIdx = -1;
  let delimiter = ',';

  // Mencari baris judul tabel
  for (let i = 0; i < Math.min(300, lines.length); i++) {
    const upperLine = lines[i].toUpperCase();
    if (upperLine.includes('NIM') && (upperLine.includes('NAMA MAHASISWA') || upperLine.includes('NAMA'))) {
      headerIdx = i;
      delimiter = (lines[i].match(/;/g) || []).length > (lines[i].match(/,/g) || []).length ? ';' : ',';
      break;
    }
  }

  if (headerIdx === -1) return [];

  const parseLine = (line, delim) => {
    let clean = line.trim();
    if (clean.endsWith(';')) clean = clean.slice(0, -1);
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.slice(1, -1);
    }
    
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delim && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(s => s.replace(/^"+|"+$/g, '').trim());
  };

  const rawHeaders = parseLine(lines[headerIdx], delimiter);
  const headers = rawHeaders.map(h => h.toUpperCase().trim());

  const data = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = parseLine(lines[i], delimiter);
    let obj = {};
    headers.forEach((h, idx) => {
      if (h) {
        obj[h] = row[idx] || '';
      }
    });
    if (obj['NIM'] || obj['NAMA MAHASISWA'] || obj['NAMA']) {
      data.push(obj);
    }
  }
  return data;
};

export default function App() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProdi, setFilterProdi] = useState("Semua");
  // Filter status diset "AKTIF" sebagai default bawaan (standby)
  const [filterStatus, setFilterStatus] = useState("AKTIF"); 
  const [isClient, setIsClient] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  useEffect(() => {
    setIsClient(true);
    // Memuat data secara otomatis dari folder public (jika file data-ppds.csv ada)
    fetch('/data-ppds.csv')
      .then(response => {
        if (!response.ok) throw new Error("File tidak ditemukan");
        return response.text();
      })
      .then(text => {
        setData(parseCSV(text));
      })
      .catch(err => {
        console.log("Belum ada file otomatis, silakan upload manual CSV.", err);
      });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProdi, filterStatus, itemsPerPage]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const parsedData = parseCSV(text);
        setData(parsedData);
        setCurrentPage(1);
      };
      reader.readAsText(file);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = (item['NAMA MAHASISWA']?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item['NIM']?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchProdi = filterProdi === "Semua" || item['PRODI'] === filterProdi;
      
      // Menyesuaikan format teks saat memfilter status
      const itemStatus = (item['KETERANGAN'] || '').trim().toUpperCase();
      const matchStatus = filterStatus === "Semua" || itemStatus === filterStatus.toUpperCase();
      
      return matchSearch && matchProdi && matchStatus;
    });
  }, [data, searchTerm, filterProdi, filterStatus]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentTableData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const stats = useMemo(() => {
    const total = filteredData.length;
    // Pada stats ini kita hitung dari kumpulan data yang TERSARING
    // Tapi karena kita ingin metrik menampilkan konteks yang jelas, kita ambil data murni
    const aktif = filteredData.filter(d => (d['KETERANGAN'] || '').trim().toUpperCase() === 'AKTIF').length;
    const lulus = filteredData.filter(d => (d['KETERANGAN'] || '').trim().toUpperCase() === 'LULUS').length;
    
    const prodiCount = {};
    filteredData.forEach(d => {
      if(d['PRODI']) {
        prodiCount[d['PRODI']] = (prodiCount[d['PRODI']] || 0) + 1;
      }
    });
    // Diurutkan berdasarkan abjad (A-Z)
    const prodiList = Object.entries(prodiCount).sort((a, b) => a[0].localeCompare(b[0]));

    const provinsiCount = {};
    filteredData.forEach(d => {
      if(d['PROVINSI']) {
        provinsiCount[d['PROVINSI']] = (provinsiCount[d['PROVINSI']] || 0) + 1;
      }
    });
    const provinsiList = Object.entries(provinsiCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const genderCount = { 'Pria': 0, 'Wanita': 0 };
    filteredData.forEach(d => {
      const jk = (d['JENIS KELAMIN'] || '').toUpperCase();
      if(jk.includes('LAKI') || jk === 'L') genderCount['Pria']++;
      if(jk.includes('PEREMPUAN') || jk === 'P') genderCount['Wanita']++;
    });

    return { total, aktif, lulus, prodiList, provinsiList, genderCount };
  }, [filteredData]);

  const uniqueProdis = useMemo(() => {
    return [...new Set(data.map(d => d['PRODI']).filter(Boolean))].sort();
  }, [data]);

  const uniqueStatus = useMemo(() => {
    const statuses = data.map(d => (d['KETERANGAN'] || '').trim().toUpperCase()).filter(Boolean);
    return [...new Set(statuses)].sort();
  }, [data]);

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            
            {/* Tempat Logo RSSA */}
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm relative">
               <img 
                 src="/logo-rssa.png" 
                 alt="Logo RSSA" 
                 className="h-full w-full object-cover z-10"
                 onError={(e) => {
                   e.target.style.display = 'none';
                   document.getElementById('fallback-icon').style.display = 'block';
                 }}
               />
               <Activity id="fallback-icon" className="h-6 w-6 text-indigo-600 hidden absolute" />
            </div>

            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Sistem Informasi PPDS RSSA</h1>
            <h1 className="text-xl font-bold text-gray-900 sm:hidden">SI PPDS RSSA</h1>
          </div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 border border-indigo-200">
              <Upload className="w-4 h-4 hidden sm:block" />
              Unggah Data (CSV)
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari nama atau NIM mahasiswa..."
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                title="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex w-full md:w-auto gap-4">
            <select
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={filterProdi}
              onChange={(e) => setFilterProdi(e.target.value)}
            >
              <option value="Semua">Semua Program Studi</option>
              {uniqueProdis.map(prodi => (
                <option key={prodi} value={prodi}>{prodi}</option>
              ))}
            </select>
            <select
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Semua">Semua Status</option>
              {uniqueStatus.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Mahasiswa</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <UserCheck className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status Aktif</p>
              <p className="text-2xl font-bold text-gray-900">{stats.aktif}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Lulus</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lulus}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-full text-orange-600">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Program Studi</p>
              <p className="text-2xl font-bold text-gray-900">{stats.prodiList.length}</p>
            </div>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900">Sebaran Program Studi</h2>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {stats.prodiList.length > 0 ? stats.prodiList.map(([prodi, count]) => {
                const percentage = (count / stats.total) * 100;
                return (
                  <div key={prodi} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate mr-2">{prodi}</span>
                      <span className="text-gray-500 font-medium">{count} Orang</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-500 h-2.5 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center text-gray-400 py-8">Tidak ada data</div>
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Jenis Kelamin</h2>
              <div className="flex justify-around items-center pt-2">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                    {stats.genderCount['Pria']}
                  </div>
                  <span className="text-sm font-medium text-gray-600">Pria</span>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                    {stats.genderCount['Wanita']}
                  </div>
                  <span className="text-sm font-medium text-gray-600">Wanita</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <MapPin className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-bold text-gray-900">Top 5 Provinsi Asal</h2>
              </div>
              <ul className="space-y-3">
                {stats.provinsiList.length > 0 ? stats.provinsiList.map(([provinsi, count], idx) => (
                  <li key={provinsi} className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-gray-400 font-mono">{idx + 1}.</span> 
                      <span className="font-medium text-gray-700">{provinsi}</span>
                    </span>
                    <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-md font-medium">{count}</span>
                  </li>
                )) : (
                  <div className="text-center text-gray-400 py-4">Tidak ada data</div>
                )}
              </ul>
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Data Rinci Mahasiswa</h2>
              <p className="text-sm text-gray-500 mt-1">Menampilkan data berdasarkan filter yang dipilih</p>
            </div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
              Total: {filteredData.length}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4 font-semibold">NIM</th>
                  <th className="p-4 font-semibold">Nama Mahasiswa</th>
                  <th className="p-4 font-semibold">Program Studi</th>
                  <th className="p-4 font-semibold hidden md:table-cell">Gender</th>
                  <th className="p-4 font-semibold hidden lg:table-cell">Provinsi</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {currentTableData.length > 0 ? currentTableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{row['NIM']}</td>
                    <td className="p-4 text-gray-700 font-medium">{row['NAMA MAHASISWA']}</td>
                    <td className="p-4 text-gray-600">{row['PRODI']}</td>
                    <td className="p-4 text-gray-600 hidden md:table-cell">
                      {row['JENIS KELAMIN']?.toUpperCase().includes('LAKI') || row['JENIS KELAMIN'] === 'L' ? 'Pria' : 'Wanita'}
                    </td>
                    <td className="p-4 text-gray-600 hidden lg:table-cell">{row['PROVINSI']}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (row['KETERANGAN'] || '').trim().toUpperCase() === 'AKTIF' ? 'bg-green-100 text-green-700' : 
                        (row['KETERANGAN'] || '').trim().toUpperCase() === 'LULUS' ? 'bg-indigo-100 text-indigo-700' : 
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {row['KETERANGAN'] || '-'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      Tidak ada data yang ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredData.length > 0 && (
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between bg-white border-t border-gray-100 gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <span className="text-sm text-gray-600">
                  Menampilkan <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-semibold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> dari <span className="font-semibold">{filteredData.length}</span> data
                </span>
                
                <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                  <span className="text-sm text-gray-600">Tampilkan:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="border border-gray-300 rounded-md text-sm py-1 px-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 hover:bg-white transition-colors cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium text-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Sebelumnya
                </button>
                <div className="flex items-center px-3 text-sm font-medium text-gray-600 bg-gray-50 rounded-md border border-gray-100">
                  {currentPage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium text-gray-700 transition-colors"
                >
                  Selanjutnya <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c7c7cc; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a1a1aa; 
        }
      `}} />
    </div>
  );
}