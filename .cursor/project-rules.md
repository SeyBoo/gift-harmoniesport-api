# Giftasso - Business Context & Project Rules

## Company Overview
Giftasso is a platform connecting donors with charitable associations through digital and physical collectible cards featuring celebrities. The platform operates under the tagline "1 carte 1 Impact, le monde entre tes mains" (1 card 1 Impact, the world in your hands), emphasizing that each card purchase creates a positive social impact.

## Business Model
- Digital greeting/gift cards platform with integrated charitable donations
- Connects donors with associations (charities/nonprofits)
- Celebrity endorsements and partnerships for special cards
- Revenue comes from card purchases with a portion going to charities
- Different pricing tiers (digital, basic, premium, plus) with varying benefits

## Target Audience
- Individual donors looking to make an impact
- Organizations wanting to give back
- Users seeking digital greeting cards with purpose
- Primary market is French-speaking, with multilingual support

## User Types
- **Associations**: Charitable organizations that create campaigns and receive donations
- **Donors**: Users who purchase cards/products to support associations
- **Celebrities**: Public figures who partner with associations for campaigns

## Product Features
- **Digital Cards**: Generated images featuring celebrities with customizable elements
- **Physical Cards**: Printed versions of digital cards shipped to donors
- **Bundles**: Different pricing tiers (digital, basic, premium, plus) with varying benefits
- **Campaigns**: Collections of products associated with specific causes/themes
- **AI-Generated Content**: Video/image generation for promotional content
- **Thematics**: Categories of charitable causes users can browse and support

## Technical Architecture
### Backend
- NestJS API with MySQL database
- Image Generation: Custom service using Jimp for card creation
- Payment Processing: Stripe integration for handling transactions
- Storage: AWS/DigitalOcean Spaces for media storage
- Authentication: Email-based authentication system

### Frontend
- Next.js application
- React with TypeScript
- Redux for state management
- i18n for internationalization (French primary, with multilingual support)
- TailwindCSS for styling
- REST API integration with backend services

### Analytics
- Google Analytics for user behavior tracking
- PostHog for user journey analysis

## Business Rules
1. All products must be associated with a campaign and charity
2. Pricing can be configured differently per product and bundle type
3. Associations receive funds from product sales after platform fees
4. Each product should support multilingual content
5. Cards should maintain consistent branding while allowing customization
6. Celebrity partnerships require proper attribution and approval

## Development Guidelines
- Ensure all new features consider the multilingual nature of the platform
- Pay special attention to image generation quality and performance
- Maintain separation between different user types and their permissions
- Consider scalability for handling multiple campaigns/products simultaneously
- Follow existing patterns for new features to maintain consistency

## Development Priorities
1. **SEO optimization** - Critical for visibility and acquisition
2. **Performance and speed** - Essential for conversion and user retention
3. **User experience (UX)** - Must be intuitive, accessible, and delightful
4. Seamless donation/payment process
5. Clear presentation of impact/charitable component
6. Mobile-responsive design
7. Security for payment processing

## Technical Standards
- Follow the API architecture outlined in api-rules.mdc
- Ensure proper error handling for payment processes
- Write comprehensive tests for critical business logic
- Optimize image processing for speed and quality
- Document all business logic that implements company rules
- **Page load times** under 2 seconds (Core Web Vitals optimization)
- **SEO-friendly architecture** with proper metadata, semantic HTML, and schema markup

## Brand Values
- Social impact
- Connecting giving with tangible outcomes
- Transparency about charitable donations
- Modern, digital approach to charitable giving
- User-friendly experience 