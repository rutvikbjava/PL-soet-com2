"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  section: string | null;
  status: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  employee_id: string | null;
  designation: string | null;
  date_of_joining: string | null;
  qualification: string | null;
  specialization: string | null;
  experience_years: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  photo_url: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [qualification, setQualification] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);

        const supabase = createBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const userEmail = session.user.email || "";

        // Fetch user profile
        const { data: userData } = await (supabase.from("users") as any)
          .select("*")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        const profile = userData as UserProfile;
        setUser(profile);

        // Populate editable fields
        setFullName(profile.full_name || "");
        setPhone(profile.phone || "");
        setGender(profile.gender || "");
        setDateOfBirth(profile.date_of_birth || "");
        setEmployeeId(profile.employee_id || "");
        setDesignation(profile.designation || "");
        setDateOfJoining(profile.date_of_joining || "");
        setQualification(profile.qualification || "");
        setSpecialization(profile.specialization || "");
        setExperienceYears(profile.experience_years?.toString() || "");
        setAddress(profile.address || "");
        setCity(profile.city || "");
        setState(profile.state || "");
        setPincode(profile.pincode || "");
        setPhotoUrl(profile.photo_url || null);

        setLoading(false);
      } catch (err) {
        console.error("Fetch profile error:", err);
        router.push("/login");
      }
    };

    fetchProfile();
  }, [router]);

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const supabase = createBrowserClient();

      // Build update object with only editable fields
      const updates: any = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        pincode: pincode.trim() || null,
      };

      // Add professional fields only for non-students
      if (user?.role !== "student") {
        updates.employee_id = employeeId.trim() || null;
        updates.designation = designation.trim() || null;
        updates.date_of_joining = dateOfJoining || null;
        updates.qualification = qualification.trim() || null;
        updates.specialization = specialization.trim() || null;
        updates.experience_years = experienceYears ? parseInt(experienceYears, 10) : null;
      }

      // Update user row
      const { error } = await (supabase.from("users") as any)
        .update(updates)
        .eq("email", user?.email);

      if (error) {
        setMessage({ text: error.message || "Failed to save profile", type: "error" });
        setSaving(false);
        return;
      }

      setMessage({ text: "Profile saved", type: "success" });
      setSaving(false);
    } catch (err: any) {
      console.error("Save profile error:", err);
      setMessage({ text: err.message || "An error occurred", type: "error" });
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    setMessage(null);

    try {
      const supabase = createBrowserClient();

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `avatars/${user.email}-${timestamp}-${file.name}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("assignments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setMessage({ text: uploadError.message || "Failed to upload photo", type: "error" });
        setUploadingPhoto(false);
        return;
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from("assignments")
        .getPublicUrl(fileName);

      const publicUrl = publicData.publicUrl;

      // Update user photo_url
      const { error: updateError } = await (supabase.from("users") as any)
        .update({ photo_url: publicUrl })
        .eq("email", user.email);

      if (updateError) {
        setMessage({ text: updateError.message || "Failed to update photo URL", type: "error" });
        setUploadingPhoto(false);
        return;
      }

      // Update local state
      setPhotoUrl(publicUrl);
      setMessage({ text: "Photo updated successfully", type: "success" });
      setUploadingPhoto(false);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      setMessage({ text: err.message || "An error occurred", type: "error" });
      setUploadingPhoto(false);
    }
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Validation
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ text: "Password must be at least 6 characters", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "Passwords do not match", type: "error" });
      return;
    }

    setChangingPassword(true);

    try {
      const supabase = createBrowserClient();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordMessage({ text: error.message || "Failed to change password", type: "error" });
        setChangingPassword(false);
        return;
      }

      setPasswordMessage({ text: "Password changed successfully", type: "success" });
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
    } catch (err: any) {
      console.error("Change password error:", err);
      setPasswordMessage({ text: err.message || "An error occurred", type: "error" });
      setChangingPassword(false);
    }
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isStudent = user.role === "student";

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={user.email} userRole={user.role} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">My Profile</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            View and update your personal information
          </p>
        </div>

        {/* Global Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            <p className="text-sm font-poppins">{message.text}</p>
          </div>
        )}

        {/* Photo Section */}
        <div className="card mb-6">
          <h2 className="section-heading">Profile Photo</h2>
          <div className="flex items-center gap-6">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-2 border-college-peach"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-college-secondary text-white flex items-center justify-center text-3xl font-bold font-poppins">
                {getInitial(user.full_name)}
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="input-field"
              />
              <p className="text-xs text-gray-400 font-poppins mt-1">
                {uploadingPhoto ? "Uploading..." : "Upload a new profile photo (jpg, png)"}
              </p>
            </div>
          </div>
        </div>

        {/* Read-Only Information */}
        <div className="card mb-6">
          <h2 className="section-heading">Account Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 font-poppins mb-1">
                Email
              </label>
              <p className="text-sm text-gray-700 font-poppins">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 font-poppins mb-1">
                Role
              </label>
              <p className="text-sm text-gray-700 font-poppins capitalize">{user.role}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 font-poppins mb-1">
                Department
              </label>
              <p className="text-sm text-gray-700 font-poppins">{user.department || "—"}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 font-poppins mb-1">
                Status
              </label>
              <p className="text-sm text-gray-700 font-poppins capitalize">{user.status}</p>
            </div>
          </div>
        </div>

        {/* Editable Profile Form */}
        <form onSubmit={handleSaveProfile}>
          {/* Personal Card */}
          <div className="card mb-6">
            <h2 className="section-heading">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="fullName" className="label">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={saving}
                  className="input-field"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label htmlFor="phone" className="label">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={saving}
                  className="input-field"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label htmlFor="gender" className="label">
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={saving}
                  className="input-field"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="dateOfBirth" className="label">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={saving}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Professional Card (hide for students) */}
          {!isStudent && (
            <div className="card mb-6">
              <h2 className="section-heading">Professional Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employeeId" className="label">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    id="employeeId"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="Enter employee ID"
                  />
                </div>
                <div>
                  <label htmlFor="designation" className="label">
                    Designation
                  </label>
                  <input
                    type="text"
                    id="designation"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="e.g. Assistant Professor"
                  />
                </div>
                <div>
                  <label htmlFor="dateOfJoining" className="label">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    id="dateOfJoining"
                    value={dateOfJoining}
                    onChange={(e) => setDateOfJoining(e.target.value)}
                    disabled={saving}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="experienceYears" className="label">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    id="experienceYears"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="Enter years of experience"
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="qualification" className="label">
                    Qualification
                  </label>
                  <input
                    type="text"
                    id="qualification"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="e.g. Ph.D. in Computer Science"
                  />
                </div>
                <div>
                  <label htmlFor="specialization" className="label">
                    Specialization
                  </label>
                  <input
                    type="text"
                    id="specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="e.g. Machine Learning"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Address Card */}
          <div className="card mb-6">
            <h2 className="section-heading">Address Information</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="address" className="label">
                  Address
                </label>
                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={saving}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Enter full address"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="label">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="label">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="Enter state"
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className="label">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    id="pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    disabled={saving}
                    className="input-field"
                    placeholder="Enter PIN code"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button type="submit" disabled={saving} className="btn-primary w-full mb-6">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        {/* Change Password Card */}
        <div className="card">
          <h2 className="section-heading">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="label">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
                className="input-field"
                placeholder="Enter new password (min 6 characters)"
                minLength={6}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
                className="input-field"
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>

            {passwordMessage && (
              <div className={`p-3 rounded-lg text-sm font-poppins ${passwordMessage.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {passwordMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={changingPassword}
              className="btn-primary w-full"
            >
              {changingPassword ? "Changing Password..." : "Change Password"}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
