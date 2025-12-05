import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Eye, EyeOff, Save, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const profileSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  zipCode: z.string().regex(/^\d{5}$/, 'Zip code must be 5 digits'),
  birthday: z.date({
    message: 'A valid birthday is required',
  }).refine(date => date < new Date(), 'Birthday must be in the past'),
  householdSize: z.number().min(1).max(12),
  grocer1: z.string().trim().min(1, "Grocer 1 is required"),
  grocer2: z.string().trim().min(1, "Grocer 2 is required"),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      householdSize: 1,
    }
  });

  const selectedDate = watch('birthday');

  // Fetch user profile data
  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // First try to get data from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Get user metadata from auth user object
      const metaData = user.user_metadata || {};

      // Use profile data if available, otherwise fall back to user meta data
      const data = profileData || {};

      setProfileData({ ...data, ...metaData });
      
      // Populate form with existing data (prioritize profiles table, then user meta data)
      reset({
        email: (data as any).email || (metaData as any).email || user.email || '',
        firstName: (data as any).first_name || (metaData as any).first_name || '',
        lastName: (data as any).last_name || (metaData as any).last_name || '',
        zipCode: (data as any).zip_code || (metaData as any).zip_code || '',
        birthday: (data as any).birthday ? new Date((data as any).birthday) : 
                 (metaData as any).birthday ? new Date((metaData as any).birthday) : 
                 new Date(2000, 0, 1),
        householdSize: (data as any).household_size || (metaData as any).household_size || 1,
        grocer1: (data as any).grocer_1 || (metaData as any).grocer_1 || '',
        grocer2: (data as any).grocer_2 || (metaData as any).grocer_2 || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          zip_code: data.zipCode,
          birthday: data.birthday.toISOString().split('T')[0],
          household_size: data.householdSize,
          grocer_1: data.grocer1,
          grocer_2: data.grocer2,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // Update user metadata through auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          zip_code: data.zipCode,
          birthday: data.birthday.toISOString().split('T')[0],
          household_size: data.householdSize,
          grocer_1: data.grocer1,
          grocer_2: data.grocer2,
          email: data.email
        }
      });

      if (profileError && authError) {
        throw new Error('Failed to update profile in both places');
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      // Refresh profile data
      await fetchProfileData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ProxCard>
        <ProxCardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </ProxCardContent>
      </ProxCard>
    );
  }

  return (
    <ProxCard>
      <ProxCardHeader>
        <ProxCardTitle className="flex items-center space-x-2 text-2xl font-primary font-semibold text-black">
          <User className="h-6 w-6" />
          <span>Profile Settings</span>
        </ProxCardTitle>
      </ProxCardHeader>
      <ProxCardContent>
        {/* Profile Data Display */}
        {profileData && (
          <div className="mb-6 p-4 bg-muted/30 rounded-prox border border-border/50">
            <h3 className="text-lg font-medium text-foreground font-primary mb-4">Current Profile Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Name:</span>
                  <span className="text-foreground font-medium">
                    {(profileData as any).first_name || (profileData as any).firstName} {(profileData as any).last_name || (profileData as any).lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Email:</span>
                  <span className="text-foreground font-medium">{(profileData as any).email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Zip Code:</span>
                  <span className="text-foreground font-medium">{(profileData as any).zip_code || (profileData as any).zipCode}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Birthday:</span>
                  <span className="text-foreground font-medium">
                    {(profileData as any).birthday ? format(new Date((profileData as any).birthday), "MMM d, yyyy") : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Household Size:</span>
                  <span className="text-foreground font-medium">{(profileData as any).household_size || (profileData as any).householdSize || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Grocer 1:</span>
                  <span className="text-foreground font-medium">{(profileData as any).grocer_1 || (profileData as any).grocer1 || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-secondary">Grocer 2:</span>
                  <span className="text-foreground font-medium">{(profileData as any).grocer_2 || (profileData as any).grocer2 || 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground font-primary">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-secondary text-black">First Name</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  className="h-12"
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="font-secondary text-black">Last Name</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  className="h-12"
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-secondary text-black">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                className="h-12"
                disabled
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Location & Household Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground font-primary">Location & Household</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zipCode" className="font-secondary text-black">Zip Code</Label>
                <Input
                  id="zipCode"
                  {...register('zipCode')}
                  className="h-12"
                  placeholder="12345"
                />
                {errors.zipCode && (
                  <p className="text-sm text-destructive">{errors.zipCode.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="householdSize" className="font-secondary text-black">Household Size</Label>
                <Input
                  id="householdSize"
                  type="number"
                  min="1"
                  max="12"
                  {...register('householdSize', { valueAsNumber: true })}
                  className="h-12"
                />
                {errors.householdSize && (
                  <p className="text-sm text-destructive">{errors.householdSize.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-secondary text-black">Birthday</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedDate ? selectedDate.getFullYear().toString() : ""}
                  onValueChange={(year) => {
                    const selectedYear = parseInt(year);
                    const newDate = new Date(selectedYear, 0, 1); // January 1st of selected year
                    setValue('birthday', newDate);
                  }}
                >
                  <SelectTrigger className="h-12 flex-1">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "h-12 px-3",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setValue('birthday', date)}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      defaultMonth={selectedDate || new Date(2000, 0)}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {selectedDate ? (
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "MMMM d, yyyy")}
                </p>
              ) : null}
              {errors.birthday && (
                <p className="text-sm text-destructive">{errors.birthday.message}</p>
              )}
            </div>
          </div>

          {/* Shopping Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground font-primary">Shopping Preferences</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grocer1" className="font-secondary text-black">Most Visited Grocer 1</Label>
                <Input
                  id="grocer1"
                  {...register('grocer1')}
                  className="h-12"
                  placeholder="e.g., Whole Foods Market"
                />
                {errors.grocer1 && (
                  <p className="text-sm text-destructive">{errors.grocer1.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="grocer2" className="font-secondary text-black">Most Visited Grocer 2</Label>
                <Input
                  id="grocer2"
                  {...register('grocer2')}
                  className="h-12"
                  placeholder="e.g., Trader Joe's"
                />
                {errors.grocer2 && (
                  <p className="text-sm text-destructive">{errors.grocer2.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              type="submit"
              className="h-12 bg-accent hover:bg-accent/90 text-white font-primary font-medium px-8"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </ProxCardContent>
    </ProxCard>
  );
}
