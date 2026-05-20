import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Search, Star } from 'lucide-react'

const allFilterValue = 'All'
const rowsPerPage = 25
const basePath = import.meta.env.BASE_URL
const logoPath = `${basePath}lululemon-logo.png`
const reviewsPath = `${basePath}data/reviews.json`
const reviewsWithImagesPath = `${basePath}data/reviewsWithImages.json`
const imagesPath = `${basePath}data/images.json`

const reviewNavItems = [
  { label: 'Summary', href: `${basePath}#summary`, kind: 'anchor' },
  { label: 'Themes', href: `${basePath}#complaints`, kind: 'anchor' },
  { label: 'Groups', href: `${basePath}#groups`, kind: 'anchor' },
  { label: 'Gallery', href: `${basePath}#gallery`, kind: 'anchor' },
  { label: 'Reviews', href: '/reviews', kind: 'link', active: true },
]

function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function normalizeId(value) {
  return hasValue(value) ? String(value).trim() : ''
}

function normalizeOptionalTruth(value) {
  if (!hasValue(value)) {
    return null
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  const normalized = String(value).trim().toLowerCase()

  if (['true', 'yes', 'y', '1', 'verified'].includes(normalized)) {
    return true
  }

  if (['false', 'no', 'n', '0', 'unverified'].includes(normalized)) {
    return false
  }

  return null
}

function formatShortDate(value) {
  if (!hasValue(value)) {
    return '—'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value)
  }

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncateText(value, maxLength = 180) {
  if (!hasValue(value)) {
    return '—'
  }

  const text = String(value).trim()
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength).trim()}...`
}

function parseUrlList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String)
  }

  if (!hasValue(value)) {
    return []
  }

  const text = String(value).trim()

  if (text === '[]') {
    return []
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const normalized = text.replace(/'/g, '"')
      const parsed = JSON.parse(normalized)
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []
    } catch {
      return text
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    }
  }

  return text
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
}

function mergeUniqueUrls(...collections) {
  return [...new Set(collections.flat().filter(Boolean))]
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (hasValue(value)) {
      return value
    }
  }

  return ''
}

function ratingBadgeClassName(rating) {
  if (rating === 1) {
    return 'bg-[#E20010] text-white'
  }

  if (rating === 2) {
    return 'bg-[#1a1a1a] text-white'
  }

  if (rating === 3) {
    return 'bg-[#f5f5f5] text-[#1a1a1a]'
  }

  return 'bg-[#4a4a4a] text-white'
}

function Panel({ children, className = '' }) {
  return (
    <div
      className={`soft-card rounded-[28px] border border-black/6 bg-white/88 ${className}`}
    >
      {children}
    </div>
  )
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#767676]">
        {eyebrow}
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#000000] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4a4a4a] sm:text-[15px]">
        {description}
      </p>
    </div>
  )
}

function RatingBadge({ rating }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ratingBadgeClassName(
        rating,
      )}`}
    >
      <Star size={12} className="fill-current" />
      {rating} Star
    </span>
  )
}

function buildReviewRows(reviewsData, reviewsWithImagesData, imagesData) {
  const imageMetaById = new Map()
  const reviewsWithImagesById = new Map()

  for (const item of Array.isArray(imagesData) ? imagesData : []) {
    const reviewId = normalizeId(item.review_id)
    if (!reviewId) {
      continue
    }

    const current = imageMetaById.get(reviewId) || {
      imageUrls: [],
      complaintTheme: '',
      verifiedBuyer: null,
      reviewDate: '',
      title: '',
      reviewText: '',
    }

    current.imageUrls = mergeUniqueUrls(current.imageUrls, [item.image_url])
    current.complaintTheme = pickFirstValue(current.complaintTheme, item.complaint_theme)
    current.reviewDate = pickFirstValue(current.reviewDate, item.review_date)
    current.title = pickFirstValue(current.title, item.review_title)
    current.reviewText = pickFirstValue(current.reviewText, item.review_text)
    current.verifiedBuyer =
      current.verifiedBuyer ?? normalizeOptionalTruth(item.verified_buyer)

    imageMetaById.set(reviewId, current)
  }

  for (const item of Array.isArray(reviewsWithImagesData) ? reviewsWithImagesData : []) {
    const reviewId = normalizeId(item.review_id)
    if (!reviewId) {
      continue
    }

    reviewsWithImagesById.set(reviewId, {
      rating: safeNumber(item.rating),
      reviewDate: item.review_date,
      title: item.review_title,
      reviewText: item.review_text,
      complaintTheme: item.complaint_theme,
      imageUrls: parseUrlList(item.photo_urls),
      imageCount: safeNumber(item.image_count),
    })
  }

  const mergedById = new Map()

  for (const review of Array.isArray(reviewsData) ? reviewsData : []) {
    const rating = safeNumber(review.rating)
    if (![1, 2, 3].includes(rating)) {
      continue
    }

    const reviewId = normalizeId(review.review_id)
    if (!reviewId) {
      continue
    }

    const reviewWithImages = reviewsWithImagesById.get(reviewId)
    const imageMeta = imageMetaById.get(reviewId)

    const reviewImageUrls = parseUrlList(review.photo_urls)
    const imageUrls = mergeUniqueUrls(
      imageMeta?.imageUrls || [],
      reviewWithImages?.imageUrls || [],
      reviewImageUrls,
    )

    mergedById.set(reviewId, {
      key: reviewId,
      reviewId,
      rating,
      reviewDate: pickFirstValue(
        review.review_date,
        review.submission_time,
        reviewWithImages?.reviewDate,
        imageMeta?.reviewDate,
      ),
      title: pickFirstValue(
        review.review_title,
        review.title,
        reviewWithImages?.title,
        imageMeta?.title,
      ),
      reviewText: pickFirstValue(
        review.review_text,
        reviewWithImages?.reviewText,
        imageMeta?.reviewText,
      ),
      complaintTheme:
        pickFirstValue(
          review.complaint_theme,
          review.category,
          reviewWithImages?.complaintTheme,
          imageMeta?.complaintTheme,
        ) || 'Unassigned',
      verifiedBuyer:
        normalizeOptionalTruth(review.verified_buyer) ??
        normalizeOptionalTruth(review.is_verified_buyer) ??
        imageMeta?.verifiedBuyer ??
        null,
      location: pickFirstValue(
        review.reviewer_location,
        review.reviewer_location_or_id,
        review.location,
      ),
      imageUrls,
      imageCount: Math.max(
        imageUrls.length,
        safeNumber(review.photo_count),
        safeNumber(reviewWithImages?.imageCount),
      ),
    })
  }

  for (const [reviewId, reviewWithImages] of reviewsWithImagesById.entries()) {
    if (mergedById.has(reviewId)) {
      continue
    }

    const rating = safeNumber(reviewWithImages.rating)
    if (![1, 2, 3].includes(rating)) {
      continue
    }

    const imageMeta = imageMetaById.get(reviewId)
    const imageUrls = mergeUniqueUrls(
      imageMeta?.imageUrls || [],
      reviewWithImages.imageUrls || [],
    )

    mergedById.set(reviewId, {
      key: reviewId,
      reviewId,
      rating,
      reviewDate: pickFirstValue(reviewWithImages.reviewDate, imageMeta?.reviewDate),
      title: pickFirstValue(reviewWithImages.title, imageMeta?.title),
      reviewText: pickFirstValue(reviewWithImages.reviewText, imageMeta?.reviewText),
      complaintTheme:
        pickFirstValue(reviewWithImages.complaintTheme, imageMeta?.complaintTheme) ||
        'Unassigned',
      verifiedBuyer: imageMeta?.verifiedBuyer ?? null,
      location: '',
      imageUrls,
      imageCount: Math.max(imageUrls.length, safeNumber(reviewWithImages.imageCount)),
    })
  }

  return [...mergedById.values()].sort((left, right) => {
    const leftTime = new Date(left.reviewDate).getTime()
    const rightTime = new Date(right.reviewDate).getTime()

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return right.reviewId.localeCompare(left.reviewId)
    }

    if (Number.isNaN(leftTime)) {
      return 1
    }

    if (Number.isNaN(rightTime)) {
      return -1
    }

    return rightTime - leftTime
  })
}

function ReviewsTablePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ratingFilter, setRatingFilter] = useState(allFilterValue)
  const [categoryFilter, setCategoryFilter] = useState(allFilterValue)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError('')

    Promise.all([
      fetch(reviewsPath).then((response) => {
        if (!response.ok) {
          throw new Error('missing_reviews')
        }
        return response.json()
      }),
      fetch(reviewsWithImagesPath).then((response) => {
        if (!response.ok) {
          throw new Error('missing_reviews_with_images')
        }
        return response.json()
      }),
      fetch(imagesPath).then((response) => {
        if (!response.ok) {
          throw new Error('missing_images')
        }
        return response.json()
      }),
    ])
      .then(([reviewsData, reviewsWithImagesData, imagesData]) => {
        if (!isMounted) {
          return
        }

        setRows(buildReviewRows(reviewsData, reviewsWithImagesData, imagesData))
        setLoading(false)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setError('Could not load review dataset. Please place the JSON files in public/data/.')
        setRows([])
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const categoryOptions = useMemo(
    () => [
      allFilterValue,
      ...new Set(
        rows
          .map((row) => row.complaintTheme)
          .filter((theme) => hasValue(theme) && theme !== 'Unassigned'),
      ),
    ],
    [rows],
  )

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesRating =
        ratingFilter === allFilterValue || String(row.rating) === ratingFilter
      const matchesCategory =
        categoryFilter === allFilterValue || row.complaintTheme === categoryFilter
      const matchesSearch =
        !normalizedSearch ||
        row.reviewId.toLowerCase().includes(normalizedSearch) ||
        row.title.toLowerCase().includes(normalizedSearch) ||
        row.reviewText.toLowerCase().includes(normalizedSearch) ||
        row.complaintTheme.toLowerCase().includes(normalizedSearch)

      return matchesRating && matchesCategory && matchesSearch
    })
  }, [categoryFilter, ratingFilter, rows, searchQuery])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / rowsPerPage)),
    [filteredRows.length],
  )

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage
    return filteredRows.slice(startIndex, startIndex + rowsPerPage)
  }, [currentPage, filteredRows])

  useEffect(() => {
    setCurrentPage(1)
  }, [ratingFilter, categoryFilter, searchQuery])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  return (
    <div className="min-h-screen bg-transparent text-[#000000]">
      <header className="sticky top-0 z-40 border-b border-black/8 bg-white/95 backdrop-blur-xl">
        <div
          className="page-shell flex items-center gap-6"
          style={{ height: '64px' }}
        >
          <Link to="/" className="flex shrink-0 items-center gap-3 no-underline">
            <img
              src={logoPath}
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0"
            />
            <span className="brand-mark text-[20px] text-black">lululemon</span>
            <span className="hidden h-4 w-px bg-[#e5e5e5] md:block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] leading-tight text-[#767676] md:block">
              Define Jacket · Reviews
            </span>
          </Link>

          <div className="h-5 w-px shrink-0 bg-black/10" />

          <nav
            className="flex flex-1 items-center gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {reviewNavItems.map((item) =>
              item.kind === 'link' ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors duration-150 ${
                    item.active
                      ? 'bg-[#f5f5f5] text-[#000000]'
                      : 'text-[#4a4a4a] hover:bg-[#f5f5f5] hover:text-[#000000]'
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-[14px] font-medium text-[#4a4a4a] transition-colors duration-150 hover:bg-[#f5f5f5] hover:text-[#000000]"
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>
        </div>
      </header>

      <main className="page-shell flex flex-col gap-6 py-6 lg:py-8">
        <Panel className="story-grid relative overflow-hidden p-7 sm:p-9">
          <div className="relative">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#767676] no-underline transition hover:bg-[#fafafa]"
            >
              <ArrowLeft size={14} />
              Back To Dashboard
            </Link>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#767676]">
              <img
                src={logoPath}
                alt="lululemon logo"
                className="h-4 w-4 shrink-0"
              />
              Review Explorer
            </div>

            <div className="mt-5">
              <SectionHeader
                eyebrow="Review Table"
                title="Low-star review explorer"
                description="Joined from the real review JSON, review-image summary JSON, and image-level JSON using review_id."
              />
            </div>
          </div>
        </Panel>

        {error ? (
          <Panel className="p-8">
            <div className="flex items-start gap-4 rounded-[24px] border border-[#e5e5e5] bg-[#fafafa] p-6">
              <div className="rounded-2xl bg-[#E20010] p-3 text-white">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#000000]">
                  Could not load review dataset. Please place the JSON files in public/data/.
                </h2>
                <p className="mt-2 text-sm leading-7 text-[#4a4a4a]">
                  Required files:{' '}
                  <span className="font-medium text-[#000000]">
                    reviews.json, reviewsWithImages.json, images.json
                  </span>
                </p>
              </div>
            </div>
          </Panel>
        ) : null}

        {loading ? (
          <Panel className="p-8">
            <div className="space-y-4">
              <div className="h-6 w-56 animate-pulse rounded-full bg-[#e5e5e5]" />
              <div className="h-12 w-full animate-pulse rounded-2xl bg-[#f5f5f5]" />
              <div className="h-12 w-full animate-pulse rounded-2xl bg-[#f5f5f5]" />
              <div className="h-12 w-full animate-pulse rounded-2xl bg-[#f5f5f5]" />
            </div>
          </Panel>
        ) : null}

        {!loading && !error ? (
          <Panel className="overflow-hidden p-0">
            <div className="border-b border-black/6 px-7 py-6 sm:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#767676]">
                    Table View
                  </p>
                  <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#000000]">
                    Real low-star review table
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#4a4a4a]">
                    Showing{' '}
                    <span className="font-semibold text-[#000000]">
                      {filteredRows.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold text-[#000000]">{rows.length}</span>{' '}
                    low-star reviews
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                  <select
                    value={ratingFilter}
                    onChange={(event) => setRatingFilter(event.target.value)}
                    className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-[#000000] outline-none transition focus:border-[#767676]/40 focus:ring-2 focus:ring-[#fafafa]"
                  >
                    {[allFilterValue, '1', '2', '3'].map((option) => (
                      <option key={option} value={option}>
                        {option === allFilterValue ? 'All Ratings' : `${option} Star`}
                      </option>
                    ))}
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-[#000000] outline-none transition focus:border-[#767676]/40 focus:ring-2 focus:ring-[#fafafa]"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === allFilterValue ? 'All Categories' : option}
                      </option>
                    ))}
                  </select>

                  <label className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#767676]"
                    />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search title, text, review id, category"
                      className="w-full min-w-[280px] rounded-xl border border-black/10 bg-white py-2 pl-10 pr-4 text-sm text-[#000000] outline-none transition placeholder:text-[#767676] focus:border-[#767676]/40 focus:ring-2 focus:ring-[#fafafa]"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-[#fafafa] text-left">
                    {[
                      'Photo',
                      'Review Date',
                      'Rating',
                      'Category',
                      'Review ID',
                      'Title',
                      'Review Text',
                      'Verified',
                      'Location',
                    ].map((label) => (
                      <th
                        key={label}
                        className="border-b border-black/6 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#767676]"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length ? (
                    paginatedRows.map((row, index) => {
                      const primaryImage = row.imageUrls[0]
                      const extraImages = Math.max(0, row.imageCount - 1)

                      return (
                        <tr
                          key={row.key}
                          className={`transition-colors hover:bg-[#fafafa] ${
                            index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                          }`}
                        >
                          <td className="border-b border-black/6 px-5 py-5 align-top">
                            {primaryImage ? (
                              <div className="w-[70px]">
                                <a href={primaryImage} target="_blank" rel="noreferrer">
                                  <img
                                    src={primaryImage}
                                    alt={row.title}
                                    className="h-[70px] w-[70px] rounded-xl object-cover"
                                  />
                                </a>
                                {extraImages > 0 ? (
                                  <p className="mt-2 text-[11px] font-medium text-[#767676]">
                                    +{extraImages} image{extraImages > 1 ? 's' : ''}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-sm text-[#767676]">No image</span>
                            )}
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top text-sm text-[#4a4a4a]">
                            {formatShortDate(row.reviewDate)}
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top">
                            <RatingBadge rating={row.rating} />
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top">
                            <span className="rounded-full bg-[#fafafa] px-3 py-1 text-xs font-semibold text-[#767676]">
                              {row.complaintTheme}
                            </span>
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top text-sm font-medium text-[#000000]">
                            {row.reviewId}
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top">
                            <p className="min-w-[220px] max-w-[280px] text-sm font-semibold leading-6 text-[#000000]">
                              {row.title || 'Untitled review'}
                            </p>
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top">
                            <p className="min-w-[320px] max-w-[420px] text-sm leading-7 text-[#4a4a4a]">
                              {truncateText(row.reviewText)}
                            </p>
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                row.verifiedBuyer === true
                                  ? 'bg-[#fafafa] text-[#767676]'
                                  : row.verifiedBuyer === false
                                    ? 'bg-[#fafafa] text-[#767676]'
                                    : 'bg-[#fafafa] text-[#a8a8a8]'
                              }`}
                            >
                              {row.verifiedBuyer === true
                                ? 'Yes'
                                : row.verifiedBuyer === false
                                  ? 'No'
                                  : '—'}
                            </span>
                          </td>
                          <td className="border-b border-black/6 px-5 py-5 align-top text-sm text-[#4a4a4a]">
                            {row.location || '—'}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr className="bg-white">
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-sm text-[#4a4a4a]"
                      >
                        No reviews match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-black/6 bg-white px-7 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-[#4a4a4a]">
                Page <span className="font-semibold text-[#000000]">{currentPage}</span> of{' '}
                <span className="font-semibold text-[#000000]">{totalPages}</span>
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#000000] transition hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#000000] transition hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next
                </button>
              </div>
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  )
}

export default ReviewsTablePage
