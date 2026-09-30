'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { NOTICE_CATEGORIES } from '@/lib/notice-categories';

interface PublishedNotice {
  id: string;
  title: string;
  type: string;
  category: string | null;
  department: string;
  scope: string;
  file_url: string | null;
  notice_content: string | null;
  publication_date: string | null;
  published_at: string | null;
  creator_id: string;
  created_at: string;
  creator_name: string;
  creator_role: string;
}

interface NoticeRecipient {
  document_id: string;
  recipient_type: 'role' | 'department';
  recipient_value: string;
}

export default function NoticeBoardPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<PublishedNotice[]>([]);
  const [filteredNotices, setFilteredNotices] = useState<PublishedNotice[]>([]);
  const [allRecipients, setAllRecipients] = useState<NoticeRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    async function fetchNotices() {
      const supabase = createBrowserClient();

      // Get session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUserEmail(session.user.email || '');

      // Get current user role and department
      const { data: userData } = await supabase
        .from('users')
        .select('role, department')
        .eq('id', session.user.id)
        .single();

      if (userData) {
        setUserRole((userData as any).role);
        setUserDepartment((userData as any).department);
      }

      // Fetch published notices
      const { data: noticesData } = await (supabase as any)
        .from('published_notices')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch all notice recipients
      const { data: recipientsData } = await (supabase as any)
        .from('notice_recipients')
        .select('document_id, recipient_type, recipient_value');

      setNotices(noticesData || []);
      setAllRecipients(recipientsData || []);
      setLoading(false);
    }

    fetchNotices();
  }, [router]);

  // Filter notices based on user relevance
  useEffect(() => {
    if (!userRole || !userDepartment) return;

    const relevantNotices = notices.filter((notice) => {
      // Show notice if ANY of these match:
      
      // 1. notice scope is 'institution'
      if (notice.scope === 'institution') return true;

      // 2. notice scope is 'college'
      if (notice.scope === 'college') return true;

      // 3. notice department matches user department
      if (notice.department === userDepartment) return true;

      // 4. user role appears in notice_recipients for that notice
      const roleMatch = allRecipients.some(
        (r) =>
          r.document_id === notice.id &&
          r.recipient_type === 'role' &&
          r.recipient_value === userRole
      );
      if (roleMatch) return true;

      // 5. user department appears in notice_recipients for that notice
      const deptMatch = allRecipients.some(
        (r) =>
          r.document_id === notice.id &&
          r.recipient_type === 'department' &&
          r.recipient_value === userDepartment
      );
      if (deptMatch) return true;

      return false;
    });

    // Apply search filter
    let filtered = relevantNotices;
    if (searchQuery.trim()) {
      filtered = filtered.filter((notice) =>
        notice.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((notice) => notice.category === selectedCategory);
    }

    setFilteredNotices(filtered);
  }, [notices, allRecipients, userRole, userDepartment, searchQuery, selectedCategory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleViewAttachment = async (fileUrl: string) => {
    try {
      const response = await fetch(`/api/notices/signed-url?path=${encodeURIComponent(fileUrl)}`);
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to get signed URL:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-college-bg min-h-screen">
        <Navbar userEmail={userEmail} />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="text-center text-college-secondary">Loading notice board...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-college-bg min-h-screen">
      <Navbar userEmail={userEmail} />
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header section */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="page-heading">Notice Board</h1>
            <p className="text-sm text-college-secondary font-poppins">
              MGM University School of Engineering & Technology
            </p>
          </div>
          <input
            type="text"
            placeholder="Search notices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field max-w-xs"
          />
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`${
              selectedCategory === 'All'
                ? 'bg-college-secondary text-white'
                : 'bg-white border border-college-peach text-college-text'
            } rounded-full px-4 py-1 text-sm font-poppins transition-colors`}
          >
            All
          </button>
          {NOTICE_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`${
                selectedCategory === category
                  ? 'bg-college-secondary text-white'
                  : 'bg-white border border-college-peach text-college-text'
              } rounded-full px-4 py-1 text-sm font-poppins transition-colors`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Notices grid */}
        {filteredNotices.length === 0 ? (
          <div className="card text-center">
            <p className="text-sm text-gray-500">No notices published yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotices.map((notice) => (
              <div key={notice.id} className="card">
                {/* Top row */}
                <div className="flex justify-between items-start">
                  <span className="bg-college-peach text-college-accent text-xs font-semibold px-3 py-1 rounded-full">
                    {notice.category || 'General'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(notice.published_at || notice.created_at)}
                  </span>
                </div>

                {/* Notice title */}
                <h3 className="font-poppins font-semibold text-college-accent text-base mt-2">
                  {notice.title}
                </h3>

                {/* Creator line */}
                <p className="text-xs text-gray-500 mt-1">
                  By {notice.creator_name} · {notice.creator_role}
                </p>

                {/* Notice content preview */}
                {notice.notice_content && (
                  <p className="text-sm text-gray-600 mt-2">
                    {notice.notice_content.length > 120
                      ? notice.notice_content.substring(0, 120) + '...'
                      : notice.notice_content}
                  </p>
                )}

                {/* Bottom row */}
                <div className="flex justify-between items-center mt-4">
                  <span className="text-xs text-gray-500 capitalize">
                    {notice.scope}
                    {notice.scope === 'department' && notice.department
                      ? ` - ${notice.department}`
                      : ''}
                  </span>
                  {notice.file_url && (
                    <button
                      onClick={() => handleViewAttachment(notice.file_url!)}
                      className="btn-secondary text-xs"
                    >
                      View Attachment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
