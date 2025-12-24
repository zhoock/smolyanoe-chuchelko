import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { getJSON } from '@shared/api/http';
import './style.scss';

interface OfferData {
  title: string;
  subtitle: string;
  meta: {
    dateLabel: string;
    websiteLabel: string;
    website: string;
  };
  intro: string;
  terms: Array<{
    term: string;
    definition: string;
  }>;
  sections: Array<{
    title: string;
    paragraphs: string[];
  }>;
  sellerInfo: {
    sellerLabel: string;
    seller: string;
    innLabel: string;
    inn: string;
    emailLabel: string;
    email: string;
    hoursLabel: string;
    hours: string;
  };
}

export function OfferPage() {
  const { lang } = useLang();
  const [offerData, setOfferData] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOfferData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getJSON<OfferData>(`offer-${lang}.json`);
        if (!cancelled) {
          setOfferData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load offer data');
          setLoading(false);
        }
      }
    }

    loadOfferData();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const currentDate = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="offer-page">
        <div className="offer-page__container">
          <p>{lang === 'ru' ? 'Загрузка...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div className="offer-page">
        <div className="offer-page__container">
          <p>{lang === 'ru' ? 'Ошибка загрузки данных' : 'Error loading data'}</p>
          {error && <p>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{lang === 'ru' ? 'Публичная оферта' : 'Public Offer'}</title>
        <meta
          name="description"
          content={
            lang === 'ru'
              ? 'Публичная оферта о заключении договора розничной купли-продажи товаров дистанционным способом'
              : 'Public offer for retail purchase and sale agreement via remote means'
          }
        />
      </Helmet>
      <div className="offer-page">
        <div className="offer-page__container">
          <h1 className="offer-page__title">{offerData.title}</h1>
          <p className="offer-page__subtitle">{offerData.subtitle}</p>

          <div className="offer-page__meta">
            <p>
              <strong>{offerData.meta.dateLabel}</strong> {currentDate}
            </p>
            <p>
              <strong>{offerData.meta.websiteLabel}</strong> {offerData.meta.website}
            </p>
          </div>

          <div className="offer-page__content">
            <p className="offer-page__intro">{offerData.intro}</p>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '1. Термины' : '1. Terms'}
              </h2>
              <dl className="offer-page__terms-list">
                {offerData.terms.map((item, index) => (
                  <React.Fragment key={index}>
                    <dt>
                      <strong>{item.term}</strong>
                    </dt>
                    <dd>{item.definition}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>

            {offerData.sections.map((section, sectionIndex) => (
              <section key={sectionIndex} className="offer-page__section">
                <h2 className="offer-page__section-title">{section.title}</h2>
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
                {sectionIndex === offerData.sections.length - 1 && (
                  <div className="offer-page__seller-info">
                    <p>
                      <strong>{offerData.sellerInfo.sellerLabel}</strong>{' '}
                      {offerData.sellerInfo.seller}
                    </p>
                    <p>
                      <strong>{offerData.sellerInfo.innLabel}</strong> {offerData.sellerInfo.inn}
                    </p>
                    <p>
                      <strong>{offerData.sellerInfo.emailLabel}</strong>{' '}
                      {offerData.sellerInfo.email}
                    </p>
                    <p>
                      <strong>{offerData.sellerInfo.hoursLabel}</strong>{' '}
                      {offerData.sellerInfo.hours}
                    </p>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
