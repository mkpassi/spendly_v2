import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  User, 
  Camera, 
  Save, 
  Mail, 
  Calendar, 
  Shield, 
  Bell, 
  Smartphone,
  CreditCard,
  Download,
  Trash2,
  Edit3,
  Loader2,
  UserX
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, userProfile, loading: authLoading, refreshUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Fallback user display data
  const getUserDisplayName = () => {
    if (fullName) {
      return fullName;
    }
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      // Extract name from email (before @)
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'User';
  };

  const getUserAvatarUrl = () => {
    console.log('🔍 ProfilePage: getUserAvatarUrl called');
    console.log('📄 ProfilePage: Current avatarUrl state:', avatarUrl);
    console.log('📄 ProfilePage: userProfile?.avatar_url:', userProfile?.avatar_url);
    console.log('🏷️ ProfilePage: user?.user_metadata?.avatar_url:', user?.user_metadata?.avatar_url);
    
    // First priority: Current state (for editing)
    if (avatarUrl) {
      console.log('🎯 ProfilePage: Using current state avatar:', avatarUrl);
      return avatarUrl;
    }
    // Second priority: Database profile
    if (userProfile?.avatar_url) {
      console.log('🎯 ProfilePage: Using database avatar_url:', userProfile.avatar_url);
      return userProfile.avatar_url;
    }
    // Third priority: Auth metadata
    if (user?.user_metadata?.avatar_url) {
      console.log('🎯 ProfilePage: Using auth metadata avatar_url:', user.user_metadata.avatar_url);
      return user.user_metadata.avatar_url;
    }
    // Fourth priority: Generate avatar
    const name = user?.email || 'User';
    const generatedUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
    console.log('🎯 ProfilePage: Using generated avatar:', generatedUrl);
    return generatedUrl;
  };

  useEffect(() => {
    console.log('📄 ProfilePage: User data changed:', user);
    console.log('📄 ProfilePage: User profile data:', userProfile);
    console.log('🏷️ ProfilePage: User metadata (fallback):', user?.user_metadata);
    console.log('📧 ProfilePage: User email:', user?.email);
    console.log('🆔 ProfilePage: User ID:', user?.id);
    
    if (user) {
      // Prioritize database profile over auth metadata
      const fullNameFromProfile = userProfile?.full_name || user.user_metadata?.full_name || '';
      const avatarFromProfile = userProfile?.avatar_url || user.user_metadata?.avatar_url || '';
      
      console.log('👤 ProfilePage: Setting full name (priority: db > auth):', fullNameFromProfile);
      console.log('🖼️ ProfilePage: Setting avatar URL (priority: db > auth):', avatarFromProfile);
      
      setFullName(fullNameFromProfile);
      setAvatarUrl(avatarFromProfile);
    }
  }, [user, userProfile]);

  const handleSave = async () => {
    if (!user) {
      console.log('❌ ProfilePage: No user found, cannot save');
      return;
    }

    console.log('💾 ProfilePage: Starting save process...');
    console.log('👤 ProfilePage: Current user ID:', user.id);
    console.log('📝 ProfilePage: Full name to save:', fullName);
    console.log('🔄 ProfilePage: Current user metadata before save:', user.user_metadata);

    setIsSaving(true);
    
    try {
      console.log('🚀 ProfilePage: Calling supabase.auth.updateUser...');
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      console.log('📋 ProfilePage: Supabase updateUser response data:', data);
      console.log('❗ ProfilePage: Supabase updateUser error:', error);

      if (error) {
        console.log('❌ ProfilePage: Error updating user auth data:', error.message);
        alert('Error updating user data: ' + error.message);
        return;
      }

      console.log('✅ ProfilePage: User auth data updated successfully');
      console.log('👤 ProfilePage: Updated user data:', data.user);
      console.log('🏷️ ProfilePage: Updated user metadata:', data.user?.user_metadata);

      // Now save to database
      console.log('💾 ProfilePage: Saving to users database table...');
      const { data: dbData, error: dbError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          full_name: fullName,
          email: user.email,
          updated_at: new Date().toISOString()
        })
        .select();

      console.log('📋 ProfilePage: Database upsert response data:', dbData);
      console.log('❗ ProfilePage: Database upsert error:', dbError);

      if (dbError) {
        console.log('❌ ProfilePage: Error saving to database:', dbError.message);
        alert('Profile saved to auth but failed to save to database: ' + dbError.message);
      } else {
        console.log('✅ ProfilePage: Successfully saved to database');
        console.log('💾 ProfilePage: Database record:', dbData);
      }
      
      // Verify the save by checking the current user
      const { data: currentUserData, error: getUserError } = await supabase.auth.getUser();
      console.log('🔍 ProfilePage: Verification - Current user data:', currentUserData);
      console.log('🔍 ProfilePage: Verification - Get user error:', getUserError);
      
      if (currentUserData.user) {
        console.log('✅ ProfilePage: Verification - User metadata after save:', currentUserData.user.user_metadata);
      }
      
      // Refresh the user profile from database
      console.log('🔄 ProfilePage: Refreshing user profile after save...');
      await refreshUserProfile();
      
      setIsEditing(false);
    } catch (err) {
      console.log('💥 ProfilePage: Unexpected error during save:', err);
      alert('Unexpected error: ' + err);
    }
    
    setIsSaving(false);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🖼️ ProfilePage: Avatar upload started...');
    
    if (!event.target.files || event.target.files.length === 0) {
      console.log('❌ ProfilePage: No file selected');
      throw new Error('You must select an image to upload.');
    }

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log('📁 ProfilePage: File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: user!.id,
      filePath: filePath
    });

    setUploading(true);
    
    try {
      console.log('☁️ ProfilePage: Uploading to Supabase storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      console.log('📋 ProfilePage: Upload response data:', uploadData);
      console.log('❗ ProfilePage: Upload error:', uploadError);

      if (uploadError) {
        console.log('❌ ProfilePage: Error uploading avatar:', uploadError.message);
        alert('Error uploading avatar: ' + uploadError.message);
        setUploading(false);
        return;
      }

      console.log('✅ ProfilePage: File uploaded successfully');

      // Get public URL
      console.log('🔗 ProfilePage: Getting public URL...');
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('🌐 ProfilePage: Public URL:', publicUrl);

      // Update user's avatar_url
      console.log('🚀 ProfilePage: Updating user avatar_url in auth...');
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      console.log('📋 ProfilePage: Avatar URL update response data:', updateData);
      console.log('❗ ProfilePage: Avatar URL update error:', updateError);

      if (updateError) {
        console.log('❌ ProfilePage: Error updating avatar URL in auth:', updateError.message);
        alert('Error updating avatar URL: ' + updateError.message);
        return;
      }

      console.log('✅ ProfilePage: Avatar URL updated in auth successfully');
      console.log('👤 ProfilePage: Updated user data:', updateData.user);
      console.log('🏷️ ProfilePage: Updated user metadata:', updateData.user?.user_metadata);

      // Now save avatar to database
      console.log('💾 ProfilePage: Saving avatar URL to users database table...');
      console.log('🔗 ProfilePage: Avatar URL being saved:', publicUrl);
      console.log('👤 ProfilePage: User ID for avatar save:', user!.id);
      const { data: dbData, error: dbError } = await supabase
        .from('users')
        .upsert({
          id: user!.id,
          avatar_url: publicUrl,
          email: user!.email,
          updated_at: new Date().toISOString()
        })
        .select();

      console.log('📋 ProfilePage: Database avatar upsert response data:', dbData);
      console.log('❗ ProfilePage: Database avatar upsert error:', dbError);

      if (dbError) {
        console.log('❌ ProfilePage: Error saving avatar to database:', dbError.message);
        alert('Avatar saved to auth but failed to save to database: ' + dbError.message);
      } else {
        console.log('✅ ProfilePage: Successfully saved avatar to database');
        console.log('💾 ProfilePage: Database avatar record:', dbData);
      }
      
      // Verify the save by checking the current user
      const { data: currentUserData, error: getUserError } = await supabase.auth.getUser();
      console.log('🔍 ProfilePage: Verification - Current user data after avatar update:', currentUserData);
      console.log('🔍 ProfilePage: Verification - Get user error:', getUserError);
      
      if (currentUserData.user) {
        console.log('✅ ProfilePage: Verification - User metadata after avatar update:', currentUserData.user.user_metadata);
      }
      
      // Refresh the user profile from database
      console.log('🔄 ProfilePage: Refreshing user profile after avatar update...');
      await refreshUserProfile();
      
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.log('💥 ProfilePage: Unexpected error during avatar upload:', err);
      alert('Unexpected error during avatar upload: ' + err);
    }
    
    setUploading(false);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16 text-slate-500">
        <UserX className="h-16 w-16 mx-auto mb-4 text-slate-300" />
        <p className="text-xl font-semibold">Please log in</p>
        <p>Sign in to manage your profile.</p>
      </div>
    );
  }

  return (
      <div>
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-green-500 h-32"></div>
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16">
              <div className="relative">
                <img
                  src={getUserAvatarUrl()}
                  alt={getUserDisplayName()}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
                {isEditing && (
                  <label className="absolute bottom-2 right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
                    {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1 sm:ml-4 mt-4 sm:mt-0">
                <h2 className="text-2xl font-bold text-slate-800">{getUserDisplayName()}</h2>
                <p className="text-slate-600">{user.email}</p>
                <p className="text-sm text-slate-500 mt-1">
                  Member since {new Date(user.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </p>
              </div>
              
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Profile Information</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={user.email!}
                      disabled
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                    />
                    <Mail className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Email cannot be changed via profile</p>
                </div>
              </div>
            </div>
        </div>
      </div>
  );
};