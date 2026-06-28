import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Users, ListTodo, Calendar, Users2, Building, PenTool, List, ArrowUpRight, Plus, Filter, UserCheck, AlertCircle, Check, Star, Zap, Shield, BarChart3, Clock, MessageSquare, ChevronRight, Play, Globe, Award, TrendingUp, Heart, Target, Layers, Settings, Phone, Mail, MapPin, ChevronDown, X, FileText } from 'lucide-react';
import Button from '../components/ui/Button';

// Import local illustrations
import heroIllustration from '../assets/illustrations/onlinesupport_1.jpg';
import ticketIllustration from '../assets/illustrations/2106.i201.045.F.m004.c9.call center technical support isometric.jpg';
import projectIllustration from '../assets/illustrations/2530832.jpg';
import timeIllustration from '../assets/illustrations/5114855.jpg';
import notificationsIllustration from '../assets/illustrations/5124327.jpg';
import assetIllustration from '../assets/illustrations/5124556.jpg';
import knowledgeIllustration from '../assets/illustrations/5138237.jpg';
import itServicesIllustration from '../assets/illustrations/7758834.jpg';
import ecommerceIllustration from '../assets/illustrations/OEVLWV0.jpg';

const IndexPage: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface">
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 bg-white/80 dark:bg-surface-elevated-80 backdrop-blur-sm border-b border-gray-200 dark:border-subtle transition-shadow duration-300 ${scrollY > 0 ? 'shadow-lg' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary-600">SafariDesk</h1>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#features" className="text-gray-600 dark:text-[var(--text-primary)] hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">Features</a>
                <a href="#benefits" className="text-gray-600 dark:text-[var(--text-primary)] hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">Benefits</a>
                <a href="#pricing" className="text-gray-600 dark:text-[var(--text-primary)] hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">Pricing</a>
                <a href="#contact" className="text-gray-600 dark:text-[var(--text-primary)] hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium">Contact</a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/docs" target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Documentation
                </Button>
              </a>
              <Link to="/join">
                <Button size="sm" className="flex items-center">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-surface dark:via-surface-elevated dark:to-surface py-20 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 to-blue-500/10"></div>
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-blue-200 rounded-full opacity-30 animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-purple-200 rounded-full opacity-25 animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Parallax Illustration */}
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-10" style={{ transform: `translateY(${scrollY * 0.5}px)` }}>
          <img
            src="https://illustrations.popsy.co/white/customer-support.svg"
            alt="Customer Support Illustration"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 text-sm font-medium mb-6 animate-pulse">
              <Zap className="w-4 h-4 mr-2" />
              Now with AI-Powered Support
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              SafariDesk Ticketing System
              <span className="block text-primary-600 animate-pulse">Made Simple</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-[var(--text-primary)] mb-8 max-w-3xl mx-auto leading-relaxed">
              Your Go-to Help Desk Solution! SafariDesk provides a simple, user-friendly ticketing system designed to simplify support and enhance efficiency for users.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/join">
                <Button size="lg" className="px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Get Started Free
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-3 border-2 hover:bg-gray-50 dark:hover:bg-surface-hover transition-all duration-300 hover:scale-105"
                onClick={() => setIsVideoModalOpen(true)}
              >
                <Play className="w-4 h-4 mr-2" />
                Watch Demo
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center group hover:scale-110 transition-transform duration-300">
                <div className="text-2xl font-bold text-primary-600 mb-2 animate-pulse">10,000+</div>
                <p className="text-gray-600 dark:text-[var(--text-primary)]">Active Users</p>
              </div>
              <div className="text-center group hover:scale-110 transition-transform duration-300">
                <div className="text-2xl font-bold text-blue-600 mb-2 animate-pulse" style={{ animationDelay: '0.5s' }}>500+</div>
                <p className="text-gray-600 dark:text-[var(--text-primary)]">Companies</p>
              </div>
              <div className="text-center group hover:scale-110 transition-transform duration-300">
                <div className="text-2xl font-bold text-purple-600 mb-2 animate-pulse" style={{ animationDelay: '1s' }}>99.9%</div>
                <p className="text-gray-600 dark:text-[var(--text-primary)]">Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white dark:bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How SafariDesk Works
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              Get started in minutes with our intuitive 3-step process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Plus className="w-10 h-10 text-primary-600" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create Your Account</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)]">
                Sign up in under 2 minutes. No credit card required for the free plan. Set up your business profile and invite your team.
              </p>
            </div>

            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Settings className="w-10 h-10 text-blue-600" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Configure & Customize</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)]">
                Set up departments, SLAs, workflows, and branding. Import your existing data or start fresh with our templates.
              </p>
            </div>

            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-10 h-10 text-purple-600" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Start Resolving Tickets</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)]">
                Begin receiving tickets via email, web forms, or API. Assign, track, and resolve issues with powerful automation.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link to="/join">
              <Button size="lg" className="px-8 py-3">
                Start Your Free Trial
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-surface-elevated relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-primary-200 to-blue-200 rounded-full opacity-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-24 h-24 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-10 animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-full opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              SafariDesk is the ideal helpdesk solution for businesses, IT firms, schools, nonprofits, and any organization seeking a top-tier, hassle-free ticketing system
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              Turning everyday support into exceptional experiences, built for the doers behind IT, service, and operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-400/5 to-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Ticket className="h-6 w-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Smart Ticketing System</h3>
                </div>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                  Create and manage tickets from email, customer portal, or manually, track progress with clear statuses and priorities.
                </p>
                <img
                  src={ticketIllustration}
                  alt="Ticket illustration"
                  className="w-20 h-20 opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-purple-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Task & Project Management</h3>
                </div>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                  SafariDesk offers task management that lets you break tickets into actions, assign teammates, and track project workflows.
                </p>
                <img
                  src={projectIllustration}
                  alt="Project management illustration"
                  className="w-20 h-20 opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-pink-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">SLA Management</h3>
                </div>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                  Set and monitor SLA with automated escalations, compliance tracking, and performance metrics to ensure timely resolutions.
                </p>
                <img
                  src={timeIllustration}
                  alt="Time management illustration"
                  className="w-20 h-20 opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-red-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Notifications & Alerts</h3>
                </div>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                  SafariDesk offers real-time email and in-app notifications for ticket updates, agent reminders, and escalations.
                </p>
                <img
                  src={assetIllustration}
                  alt="Asset management illustration"
                  className="w-20 h-20 opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-400/5 to-pink-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                    <PenTool className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Asset Management</h3>
                </div>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                  SafariDesk includes full asset management to track hardware/software lifecycle, usage, and status across your organization.
                </p>
                <img
                  src={knowledgeIllustration}
                  alt="Knowledge base illustration"
                  className="w-20 h-20 opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/5 to-purple-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                    <List className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Knowledge Base</h3>
                </div>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                  Easily build and manage a smart knowledge base with AI suggestions, rich content, approvals, and analytics support.
                </p>
                <img
                  src={knowledgeIllustration}
                  alt="Knowledge base illustration"
                  className="w-20 h-20 opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-gray-50 dark:bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              SafariDesk simplifies support, powerful tools, incredibly easy to use
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)]">
              We offer these features and many more, including a customer portal, custom integration, all within an enterprise-grade, secure environment.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                SafariDesk Version 2.0
              </h3>
              <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] mb-6">
                Unlock seamless support with SafariDesk's ticketing system, simple, smart, and ready to go.
              </p>
              <Link to="/join">
                <Button size="lg">
                  Get Started Today
                </Button>
              </Link>
            </div>
            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 mb-2">70%</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Up to 70% savings in support costs</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">95%</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Improvement in ticket turnaround time</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">0.7s</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Response time for ticket operations</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">100+</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Teams worldwide rely on SafariDesk</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white dark:bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Driving customer success through smarter efficiency.
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)]">
              SafariDesk's Impact at a Glance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-4">70%</div>
              <p className="text-gray-600 dark:text-[var(--text-primary)]">Up to 70% savings in support costs, equivalent to saving $X,000+ per year</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-4">95%</div>
              <p className="text-gray-600 dark:text-[var(--text-primary)]">Improvement in ticket turnaround time, helping teams resolve more requests without increasing headcount.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-4">0.7 seconds</div>
              <p className="text-gray-600 dark:text-[var(--text-primary)]">To search, update, or assign tickets enabling instant access to information and smoother customer interactions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50 dark:bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Choose the Plan That Fits Your Needs
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)]">
              Whether you're just starting out or looking to expand your capabilities, our plans provide the perfect solution for your needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white dark:bg-surface-elevated rounded-lg shadow-lg p-8 border-2 border-primary-200 dark:border-primary-800">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free</h3>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">Your first 10 agents are FREE!!</p>
                <div className="text-4xl font-bold text-primary-600 mb-2">$0.00</div>
                <p className="text-sm text-gray-500">Only pay for cloud storage</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Email & Web Form Ticket Creation</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Unlimited Tickets & Customers</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Basic Task Management</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Customer Portal</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Asset Management</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Public Knowledge Base / Help Centers</span>
                </li>
              </ul>
              <Link to="/join" className="w-full">
                <Button className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Standard Plan */}
            <div className="bg-white dark:bg-surface-elevated rounded-lg shadow-lg p-8 border-2 border-blue-200 dark:border-blue-800 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">Most Popular</span>
              </div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Standard</h3>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">For teams with 11 to 30 agents</p>
                <div className="text-4xl font-bold text-blue-600 mb-2">$59.00</div>
                <p className="text-sm text-gray-500">month (billed annually as $699.00)</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Everything in the Free Plan, plus:</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Automated Workflows</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Role-Based Access Control</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Satisfaction Surveys (CSAT)</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Data Export</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Email Support</span>
                </li>
              </ul>
              <Link to="/join" className="w-full">
                <Button className="w-full" variant="primary">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white dark:bg-surface-elevated rounded-lg shadow-lg p-8 border-2 border-purple-200 dark:border-purple-800">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Enterprise</h3>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">Designed for larger teams, (Unlimited Agents)</p>
                <div className="text-4xl font-bold text-purple-600 mb-2">$108.00</div>
                <p className="text-sm text-gray-500">/month Billed annually ($1,299/yr)</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Full access to all features</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Dedicated Account Manager</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Dedicated support (Email and Phone)</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">Custom resources</span>
                </li>
              </ul>
              <Link to="/join" className="w-full">
                <Button className="w-full" variant="outline">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-surface-elevated dark:to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Trusted by Teams Worldwide
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              See what our customers say about SafariDesk
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-surface-elevated rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4 italic">
                "SafariDesk transformed our support operations. We've reduced response times by 70% and our customer satisfaction scores have never been higher."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                  <span className="text-primary-600 font-bold">SJ</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Sarah Johnson</p>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">IT Director, TechCorp</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4 italic">
                "The ease of use and powerful automation features make SafariDesk perfect for our growing team. Setup took less than an hour!"
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 font-bold">MR</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Mike Rodriguez</p>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Operations Manager, StartupXYZ</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4 italic">
                "SafariDesk's SLA management and reporting capabilities give us complete visibility into our support performance. Highly recommended!"
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-3">
                  <span className="text-purple-600 font-bold">AL</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Anna Liu</p>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Support Lead, GlobalTech</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-20 bg-white dark:bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Seamless Integrations
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              Connect SafariDesk with your favorite tools and services
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center">
            <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-surface-hover rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors duration-300 group">
              <div className="text-center">
                <Mail className="w-12 h-12 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-primary)]">Gmail</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-surface-hover rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors duration-300 group">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-primary-600 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-primary)]">Slack</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-surface-hover rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors duration-300 group">
              <div className="text-center">
                <Settings className="w-12 h-12 text-purple-600 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-primary)]">Zapier</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-surface-hover rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors duration-300 group">
              <div className="text-center">
                <Globe className="w-12 h-12 text-orange-600 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-primary)]">API</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-surface-hover rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors duration-300 group">
              <div className="text-center">
                <Users className="w-12 h-12 text-red-600 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-primary)]">Teams</p>
              </div>
            </div>
            <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-surface-hover rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors duration-300 group">
              <div className="text-center">
                <Layers className="w-12 h-12 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-primary)]">Jira</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
              And many more integrations available
            </p>
            <Button variant="outline" size="lg">
              View All Integrations
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50 dark:bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)]">
              Everything you need to know about SafariDesk
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "How long does it take to set up SafariDesk?",
                answer: "You can be up and running in under 15 minutes. Our quick setup wizard guides you through the entire process, and you can import your existing data if needed."
              },
              {
                question: "Can I try SafariDesk before committing?",
                answer: "Absolutely! We offer a 14-day free trial with full access to all features. No credit card required to get started."
              },
              {
                question: "What kind of support do you provide?",
                answer: "We offer comprehensive support including email, live chat, detailed documentation, video tutorials, and dedicated account managers for Enterprise customers."
              },
              {
                question: "Is my data secure?",
                answer: "Yes, security is our top priority. We use enterprise-grade encryption, regular security audits, and comply with GDPR, SOC 2, and other industry standards."
              },
              {
                question: "Can I customize SafariDesk to match my brand?",
                answer: "Definitely! You can customize colors, logos, email templates, and even create custom fields and workflows to match your specific needs."
              },
              {
                question: "What happens to my data if I cancel?",
                answer: "You can export all your data at any time. We also offer data retention options based on your plan."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white dark:bg-surface-elevated rounded-lg shadow-sm">
                <button
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors duration-200"
                  onClick={() => toggleFaq(index)}
                >
                  <span className="text-lg font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {activeFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About/Team Section */}
      <section className="py-20 bg-white dark:bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Built by Support Experts, for Support Teams
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              Our mission is to empower support teams with intelligent tools that make their jobs easier and more effective.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Why We Built SafariDesk
              </h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-6">
                After years of working with support teams across industries, we saw a common problem: great people struggling with outdated tools. We built SafariDesk to change that.
              </p>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Heart className="w-6 h-6 text-red-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">User-Centric Design</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">Every feature is designed with real support workflows in mind.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Shield className="w-6 h-6 text-blue-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Enterprise Security</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">Bank-level security with compliance certifications.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <TrendingUp className="w-6 h-6 text-primary-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Continuous Innovation</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">Regular updates with AI-powered features and automation.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary-100 to-blue-100 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg p-8">
              <div className="text-center">
                <Award className="w-16 h-16 text-primary-600 mx-auto mb-4" />
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Award-Winning Support</h4>
                <p className="text-gray-600 dark:text-[var(--text-primary)] mb-6">
                  Recognized by industry leaders for innovation and customer satisfaction.
                </p>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary-600">4.9/5</div>
                    <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Customer Rating</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">99.9%</div>
                    <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Uptime SLA</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-surface-elevated dark:to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Perfect for Every Industry
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              SafariDesk adapts to the unique support needs of any organization
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center group">
              <div className="mb-6">
                <img
                  src={itServicesIllustration}
                  alt="IT Services illustration"
                  className="w-24 h-24 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">IT Services</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                Streamline technical support with automated ticket routing, SLA tracking, and comprehensive asset management.
              </p>
              <div className="text-sm text-primary-600 font-medium">500+ IT teams trust SafariDesk</div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center group">
              <div className="mb-6">
                <img
                  src={ecommerceIllustration}
                  alt="E-commerce illustration"
                  className="w-24 h-24 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">E-commerce</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                Handle customer inquiries, order issues, and returns efficiently with multi-channel support and automation.
              </p>
              <div className="text-sm text-blue-600 font-medium">200+ online stores powered by SafariDesk</div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center group">
              <div className="mb-6">
                <img
                  src={projectIllustration}
                  alt="Education illustration"
                  className="w-24 h-24 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Education</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                Support students, faculty, and staff with organized ticketing, knowledge bases, and department routing.
              </p>
              <div className="text-sm text-purple-600 font-medium">150+ educational institutions</div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center group">
              <div className="mb-6">
                <img
                  src={timeIllustration}
                  alt="Healthcare illustration"
                  className="w-24 h-24 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Healthcare</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                Ensure HIPAA compliance with secure patient support, appointment scheduling, and medical inquiry management.
              </p>
              <div className="text-sm text-red-600 font-medium">80+ healthcare providers</div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center group">
              <div className="mb-6">
                <img
                  src={assetIllustration}
                  alt="Finance illustration"
                  className="w-24 h-24 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Finance</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                Manage account inquiries, transaction issues, and compliance requests with enterprise-grade security.
              </p>
              <div className="text-sm text-primary-600 font-medium">120+ financial institutions</div>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center group">
              <div className="mb-6">
                <img
                  src={knowledgeIllustration}
                  alt="Manufacturing illustration"
                  className="w-24 h-24 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Manufacturing</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4">
                Coordinate maintenance requests, equipment issues, and production support across multiple facilities.
              </p>
              <div className="text-sm text-orange-600 font-medium">90+ manufacturing companies</div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-white dark:bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="mb-8">
                <img
                  src={heroIllustration}
                  alt="Security illustration"
                  className="w-32 h-32 opacity-90"
                />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Enterprise-Grade Security & Compliance
              </h2>
              <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] mb-8">
                Your data is protected with bank-level security, regular audits, and compliance with industry standards.
              </p>

              <div className="space-y-6">
                <div className="flex items-start">
                  <Shield className="w-8 h-8 text-primary-600 mr-4 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">SOC 2 Type II Certified</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">Regular security audits and compliance monitoring ensure your data stays safe.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Shield className="w-8 h-8 text-blue-600 mr-4 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">GDPR & HIPAA Compliant</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">Full compliance with global data protection regulations and healthcare privacy standards.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Shield className="w-8 h-8 text-purple-600 mr-4 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">End-to-End Encryption</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">All data is encrypted in transit and at rest using industry-standard protocols.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Shield className="w-8 h-8 text-orange-600 mr-4 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">99.9% Uptime SLA</h4>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">Guaranteed availability with automatic failover and disaster recovery.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-surface-hover dark:to-surface-elevated rounded-lg p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-white dark:bg-surface-elevated rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-primary-600 mb-2">256-bit</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">SSL Encryption</p>
                </div>
                <div className="text-center p-4 bg-white dark:bg-surface-elevated rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Security Monitoring</p>
                </div>
                <div className="text-center p-4 bg-white dark:bg-surface-elevated rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-purple-600 mb-2">ISO 27001</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Certified</p>
                </div>
                <div className="text-center p-4 bg-white dark:bg-surface-elevated rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-orange-600 mb-2">DDoS</div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Protection</p>
                </div>
              </div>

              <div className="mt-8 text-center">
                <div className="inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                  <Check className="w-5 h-5 text-primary-600 mr-2" />
                  <span className="text-sm font-medium text-primary-800 dark:text-primary-300">Trusted by Fortune 500 companies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API & Developer Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-surface dark:to-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful API & Developer Tools
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              Integrate SafariDesk with your existing systems and build custom workflows
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-12">
            <div>
              <div className="mb-8">
                <img
                  src={ticketIllustration}
                  alt="API illustration"
                  className="w-40 h-40 opacity-90"
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                RESTful API & Webhooks
              </h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] mb-6">
                Full REST API access with comprehensive documentation, webhooks for real-time updates, and SDKs for popular languages.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-primary-600 font-bold text-sm">JS</span>
                  </div>
                  <span className="text-sm font-medium">JavaScript</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-bold text-sm">PY</span>
                  </div>
                  <span className="text-sm font-medium">Python</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-purple-600 font-bold text-sm">PHP</span>
                  </div>
                  <span className="text-sm font-medium">PHP</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-orange-600 font-bold text-sm">C#</span>
                  </div>
                  <span className="text-sm font-medium">C#</span>
                </div>
              </div>

              <Link to="/docs" className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium">
                View API Documentation
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            <div className="bg-white dark:bg-surface-elevated rounded-lg p-8 shadow-lg">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Popular Integrations</h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Slack</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Real-time notifications</p>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-primary-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-4">
                      <Settings className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Zapier</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">500+ app integrations</p>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-primary-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mr-4">
                      <Mail className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Gmail</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Email ticket creation</p>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-primary-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mr-4">
                      <Layers className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Jira</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">Issue synchronization</p>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section className="py-20 bg-white dark:bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Learn & Grow with SafariDesk
            </h2>
            <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] max-w-2xl mx-auto">
              Access our comprehensive resources to maximize your support team's potential
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 text-center hover:shadow-lg transition-shadow duration-300 group">
              <div className="mb-4">
                <img
                  src={ticketIllustration}
                  alt="Documentation illustration"
                  className="w-16 h-16 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Documentation</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] text-sm mb-4">
                Comprehensive guides, API references, and best practices
              </p>
              <Button variant="outline" size="sm">Browse Docs</Button>
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-6 text-center hover:shadow-lg transition-shadow duration-300 group">
              <div className="mb-4">
                <img
                  src={projectIllustration}
                  alt="Blog illustration"
                  className="w-16 h-16 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Blog</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] text-sm mb-4">
                Tips, trends, and insights from support experts
              </p>
              <Button variant="outline" size="sm">Read Articles</Button>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6 text-center hover:shadow-lg transition-shadow duration-300 group">
              <div className="mb-4">
                <img
                  src={timeIllustration}
                  alt="Webinars illustration"
                  className="w-16 h-16 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Webinars</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] text-sm mb-4">
                Live sessions and on-demand training videos
              </p>
              <Button variant="outline" size="sm">Watch Now</Button>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-6 text-center hover:shadow-lg transition-shadow duration-300 group">
              <div className="mb-4">
                <img
                  src={assetIllustration}
                  alt="Community illustration"
                  className="w-16 h-16 mx-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Community</h3>
              <p className="text-gray-600 dark:text-[var(--text-primary)] text-sm mb-4">
                Connect with other SafariDesk users and experts
              </p>
              <Button variant="outline" size="sm">Join Community</Button>
            </div>
          </div>

          
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Support?
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Join thousands of teams already using SafariDesk to deliver exceptional customer support.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-6">Get in Touch</h3>
              <div className="space-y-6">
                <div className="flex items-center">
                  <Mail className="w-6 h-6 text-primary-400 mr-4" />
                  <div>
                    <p className="font-medium">Email Us</p>
                    <p className="text-gray-300">support@safaridesk.io</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Phone className="w-6 h-6 text-primary-400 mr-4" />
                  <div>
                    <p className="font-medium">Call Us</p>
                    <p className="text-gray-300">1-800-SAFARI (Mon-Fri, 9AM-6PM EST)</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-6 h-6 text-primary-400 mr-4" />
                  <div>
                    <p className="font-medium">Visit Us</p>
                    <p className="text-gray-300">123 Support Street, Tech City, TC 12345</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-4">Follow Us</h4>
                <div className="flex space-x-4">
                  <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors duration-300">
                    <MessageSquare className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors duration-300">
                    <Users className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors duration-300">
                    <Globe className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-8">
              <h3 className="text-2xl font-bold mb-6">Why Choose SafariDesk?</h3>

              <div className="space-y-6 mb-8">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">14-Day Free Trial</h4>
                    <p className="text-gray-300 text-sm">No credit card required. Full access to all features.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Setup in Under 15 Minutes</h4>
                    <p className="text-gray-300 text-sm">Quick wizard guides you through the entire process.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">24/7 Expert Support</h4>
                    <p className="text-gray-300 text-sm">Dedicated success team to help you get started.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Cancel Anytime</h4>
                    <p className="text-gray-300 text-sm">No long-term contracts. Export your data anytime.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Link to="/join" className="w-full">
                  <Button size="lg" className="w-full bg-primary-600 hover:bg-primary-700 mb-3">
                    Start Free Trial Now
                  </Button>
                </Link>

                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-3">Trusted by 10,000+ teams worldwide</p>
                  <div className="flex justify-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-yellow-400 text-sm font-medium ml-2">4.9/5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-primary-400 mb-4">SafariDesk</h3>
              <p className="text-gray-300 mb-4">
                Simplify support, boost productivity, and keep your team in sync.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <Users className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <MessageSquare className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="/docs" className="text-gray-300 hover:text-white">Documentation</a></li>
                <li><a href="mailto:support@safaridesk.io" className="text-gray-300 hover:text-white">Contact us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white">Terms & Conditions</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact</h4>
              <p className="text-gray-300 mb-2">support@safaridesk.io</p>
              <p className="text-gray-300">@safariDesk.io</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">© 2025. All rights reserved. SafariDesk</p>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/75 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-4xl mx-auto">
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors duration-200"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src="https://www.youtube.com/embed/KOlCaBi_2Qg?autoplay=1"
                title="SafariDesk Demo Video"
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndexPage;
