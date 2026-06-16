-- AEDE / Katambay AI - Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up clean, real-world tables from scratch!

-- 1. Profiles Table (Tracks Users and Leaderboard rankings)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'Guardian Cadet' CHECK (role IN ('Guardian Cadet', 'Guardian Elite', 'Health Liaison', 'LGU Administrator')),
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    completed_missions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to profiles" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow system profile creation on signup"
ON public.profiles FOR INSERT WITH CHECK (true);


-- 2. Community Posts Table (Citizen reports and LGU news bulletins)
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Guardian Cadet',
    content TEXT NOT NULL,
    location TEXT NOT NULL,
    likes INTEGER DEFAULT 0 CHECK (likes >= 0),
    comments INTEGER DEFAULT 0 CHECK (comments >= 0),
    verified BOOLEAN DEFAULT false,
    pinned BOOLEAN DEFAULT false,
    is_official BOOLEAN DEFAULT false,
    is_misinfo BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending-review' CHECK (status IN ('pending-review', 'verified', 'flagged')),
    type TEXT DEFAULT 'update' CHECK (type IN ('update', 'alert', 'social')),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Community Posts
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to community posts" 
ON public.community_posts FOR SELECT USING (true);

CREATE POLICY "Allow public/anonymous to insert community posts" 
ON public.community_posts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to delete their own posts" 
ON public.community_posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Allow users to update their own posts" 
ON public.community_posts FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Allow admins to update any community posts" 
ON public.community_posts FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role IN ('LGU Administrator', 'Health Liaison')
    )
);

CREATE POLICY "Allow admins to delete any community posts" 
ON public.community_posts FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role IN ('LGU Administrator', 'Health Liaison')
    )
);


-- 3. Guardian Missions Table (Dynamic task targets for volunteers)
CREATE TABLE IF NOT EXISTS public.guardian_missions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    points_reward INTEGER DEFAULT 50 NOT NULL,
    completed BOOLEAN DEFAULT false,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Missions
ALTER TABLE public.guardian_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to missions" 
ON public.guardian_missions FOR SELECT USING (true);

CREATE POLICY "Allow LGU admins to manage missions" 
ON public.guardian_missions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'LGU Administrator'
    )
);


-- 4. Anti-Spam Trigger (Enforces a 60-second cooldown rate limit per user)
CREATE OR REPLACE FUNCTION check_post_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Only rate-limit non-admin postings
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = NEW.author_id AND profiles.role NOT IN ('LGU Administrator', 'Health Liaison')
    ) THEN
        IF (
            SELECT count(*) 
            FROM public.community_posts 
            WHERE author_id = NEW.author_id AND created_at > now() - INTERVAL '1 minute'
        ) >= 1 THEN
            RAISE EXCEPTION 'Rate limit exceeded! Please wait 60 seconds before posting another report to prevent spam.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind rate limit trigger to community posts
CREATE OR REPLACE TRIGGER trg_check_post_rate_limit
BEFORE INSERT ON public.community_posts
FOR EACH ROW
EXECUTE FUNCTION check_post_rate_limit();


-- 5. Helper Function: Increment Likes
CREATE OR REPLACE FUNCTION increment_post_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.community_posts
    SET likes = likes + 1
    WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper Function: Decrement Likes
CREATE OR REPLACE FUNCTION decrement_post_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.community_posts
    SET likes = GREATEST(0, likes - 1)
    WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Dengue Cases Table (Official clinical diagnosed registry)
CREATE TABLE IF NOT EXISTS public.dengue_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barangay TEXT NOT NULL UNIQUE,
    active_cases INTEGER DEFAULT 0 CHECK (active_cases >= 0),
    baseline_cases INTEGER DEFAULT 10 CHECK (baseline_cases >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Cases
ALTER TABLE public.dengue_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cases" 
ON public.dengue_cases FOR SELECT USING (true);

CREATE POLICY "Allow system / LGU update cases" 
ON public.dengue_cases FOR ALL USING (true);

-- Seed Naga City's 27 barangays at clean default 0 cases
INSERT INTO public.dengue_cases (barangay, active_cases, baseline_cases) VALUES
('Abella', 0, 10),
('Bagumbayan Norte', 0, 10),
('Bagumbayan Sur', 0, 10),
('Balatas', 0, 10),
('Calauag', 0, 10),
('Cararayan', 0, 10),
('Carolina', 0, 10),
('Concepcion Grande', 0, 10),
('Concepcion Pequeña', 0, 10),
('Dayangdang', 0, 10),
('Del Rosario', 0, 10),
('Dinaga', 0, 10),
('Igualdad Interior', 0, 10),
('Lerma', 0, 10),
('Liboton', 0, 10),
('Mabolo', 0, 10),
('Pacol', 0, 10),
('Panicuason', 0, 10),
('Peñafrancia', 0, 10),
('Sabang', 0, 10),
('San Felipe', 0, 10),
('San Francisco (Pob.)', 0, 10),
('San Isidro', 0, 10),
('Santa Cruz', 0, 10),
('Tabuco', 0, 10),
('Tinago', 0, 10),
('Triangulo', 0, 10)
ON CONFLICT (barangay) DO NOTHING;

-- Seed Singapore Planning Areas (to prevent client-side insert permission issues)
INSERT INTO public.dengue_cases (barangay, active_cases, baseline_cases) VALUES
('Ang Mo Kio', 0, 10),
('Bedok', 0, 10),
('Bishan', 0, 10),
('Boon Lay', 0, 10),
('Bukit Batok', 0, 10),
('Bukit Merah', 0, 10),
('Bukit Panjang', 0, 10),
('Bukit Timah', 0, 10),
('Central Water Catchment', 0, 10),
('Changi', 0, 10),
('Changi Bay', 0, 10),
('Choa Chu Kang', 0, 10),
('Clementi', 0, 10),
('Downtown Core', 0, 10),
('Geylang', 0, 10),
('Hougang', 0, 10),
('Jurong East', 0, 10),
('Jurong West', 0, 10),
('Kallang', 0, 10),
('Lim Chu Kang', 0, 10),
('Mandai', 0, 10),
('Marina East', 0, 10),
('Marina South', 0, 10),
('Marine Parade', 0, 10),
('Museum', 0, 10),
('Newton', 0, 10),
('North-eastern Islands', 0, 10),
('Novena', 0, 10),
('Orchard', 0, 10),
('Outram', 0, 10),
('Pasir Ris', 0, 10),
('Paya Lebar', 0, 10),
('Pioneer', 0, 10),
('Punggol', 0, 10),
('Queenstown', 0, 10),
('River Valley', 0, 10),
('Rochor', 0, 10),
('Seletar', 0, 10),
('Sembawang', 0, 10),
('Sengkang', 0, 10),
('Serangoon', 0, 10),
('Simpang', 0, 10),
('Singapore River', 0, 10),
('Southern Islands', 0, 10),
('Straits View', 0, 10),
('Sungei Kadut', 0, 10),
('Tampines', 0, 10),
('Tanglin', 0, 10),
('Tengah', 0, 10),
('Toa Payoh', 0, 10),
('Tuas', 0, 10),
('Western Islands', 0, 10),
('Western Water Catchment', 0, 10),
('Woodlands', 0, 10),
('Yishun', 0, 10)
ON CONFLICT (barangay) DO NOTHING;


-- 8. IoT Telemetry Table (Tracks real physical sensor node readings)
CREATE TABLE IF NOT EXISTS public.iot_telemetry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    node_id TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL,
    temperature NUMERIC DEFAULT 28.5,
    humidity NUMERIC DEFAULT 75.0,
    packet_loss NUMERIC DEFAULT 0.01,
    latency INTEGER DEFAULT 10,
    status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for IoT telemetry
ALTER TABLE public.iot_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to iot_telemetry" 
ON public.iot_telemetry FOR SELECT USING (true);

CREATE POLICY "Allow system / node upsert iot_telemetry" 
ON public.iot_telemetry FOR ALL USING (true);

-- Seed default physical sensor nodes
INSERT INTO public.iot_telemetry (node_id, location, temperature, humidity, packet_loss, latency, status) VALUES
('node_dyd_01', 'Dayangdang', 29.8, 82.0, 0.012, 12, 'online'),
('node_blt_01', 'Balatas', 28.2, 76.5, 0.008, 9, 'online'),
('node_wld_01', 'Woodlands', 30.1, 85.0, 0.015, 15, 'online'),
('node_tmp_01', 'Tampines', 29.4, 79.2, 0.010, 11, 'online')
ON CONFLICT (node_id) DO NOTHING;


-- 9. Storage Setup for community-posts bucket
-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-posts', 'community-posts', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage Objects (Allows public read and authenticated/anonymous insert access)
CREATE POLICY "Allow public read access to community-posts storage"
ON storage.objects FOR SELECT USING (bucket_id = 'community-posts');

CREATE POLICY "Allow authenticated/anonymous upload access to community-posts storage"
ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'community-posts'
);

-- 10. Performance Tuning (B-Tree Indexing for High-Volume Query Optimization)
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON public.community_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_location ON public.community_posts (location);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dengue_cases_barangay ON public.dengue_cases (barangay);
