require('dotenv').config();

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID,
      VITE_COMPLETE_SIGNUP_URL: process.env.VITE_COMPLETE_SIGNUP_URL,
    },
  };
};
