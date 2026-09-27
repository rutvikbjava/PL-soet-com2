import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-college-bg flex flex-col">
      {/* Hero Section */}
      <div
        className="py-20 px-8"
        style={{ background: "linear-gradient(135deg, #703C19, #C06121)" }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {/* Logo */}
          <div className="bg-white rounded-full p-2 mb-6">
            <Image
              src="/photos/college-logo.png"
              width={80}
              height={80}
              alt="MGM University Logo"
              className="object-contain"
            />
          </div>

          {/* University Name */}
          <h1 className="font-poppins font-bold text-4xl text-white text-center mb-2">
            MGM University
          </h1>

          {/* Department */}
          <p className="font-poppins text-xl text-orange-200 text-center mb-6">
            School of Engineering & Technology
          </p>

          {/* Divider */}
          <div className="w-24 h-1 bg-white mx-auto my-6 rounded"></div>

          {/* Product Name */}
          <h2 className="font-poppins font-bold text-2xl text-white text-center mb-3">
            EduSphere AI
          </h2>

          {/* Tagline */}
          <p className="font-poppins text-base text-orange-100 text-center max-w-2xl">
            Secure Digital Workflow Automation for Higher Education
          </p>
        </div>
      </div>

      {/* Cards Section */}
      <div className="bg-white py-16 px-8 flex-1">
        <div className="max-w-5xl mx-auto flex gap-6 justify-center flex-wrap">
          {/* Card 1: Staff Login */}
          <div className="card w-full md:w-80 flex flex-col items-center">
            {/* Icon */}
            <div className="rounded-full bg-college-peach p-4 w-16 h-16 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-college-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h3 className="page-heading text-center mb-2">Staff Login</h3>

            {/* Description */}
            <p className="text-sm text-gray-500 font-poppins mt-2 mb-4 text-center">
              Access your workflow dashboard, upload documents and track approvals
            </p>

            {/* Button */}
            <Link href="/login" className="btn-primary">
              Login to Portal
            </Link>
          </div>

          {/* Card 2: About */}
          <div className="card w-full md:w-80 flex flex-col items-center">
            {/* Icon */}
            <div className="rounded-full bg-college-peach p-4 w-16 h-16 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-college-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h3 className="page-heading text-center mb-2">About EduSphere AI</h3>

            {/* Description */}
            <p className="text-sm text-gray-500 font-poppins mt-2 mb-4 text-center">
              Intelligent approval workflow automation built for MGM University SOET staff
            </p>

            {/* Button */}
            <Link href="/dashboard" className="btn-secondary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-college-accent text-white text-center py-4">
        <p className="font-poppins text-xs">
          © School of Engineering and Technology | MGM University | All Rights Reserved
        </p>
      </footer>
    </div>
  );
}
