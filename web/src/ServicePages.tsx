import { useEffect, useState, type FormEvent } from "react";
import {
  browserControlApi,
  ControlApiError,
  type ControlService,
  type ControlServiceDetail,
  type ServiceAdmin,
  type ServiceControlApi,
  type ServiceDestination,
  type ServiceDestinationInput,
  type ServiceDraftDocument,
  type ServiceLifecycle,
  type ServiceRevision,
  type ServiceValidation,
  type UserRole,
} from "./controlApi";

export function ServicesPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: ServiceControlApi;
}) {
  const [services, setServices] = useState<ControlService[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<ServiceLifecycle | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load(preferredId?: string) {
    setLoading(true);
    setError("");
    try {
      const result = await api.listServices({
        ...(query.trim() === "" ? {} : { q: query.trim() }),
        ...(lifecycle === "" ? {} : { lifecycle }),
      });
      setServices(result.services);
      setSelectedId((current) => {
        const preferred = preferredId ?? current;
        return preferred !== undefined && result.services.some(({ id }) => id === preferred)
          ? preferred
          : result.services[0]?.id;
      });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [role]); // Filters submit explicitly to avoid a request per keystroke.

  function replaceSummary(service: ControlService) {
    setServices((current) =>
      current.map((entry) => entry.id === service.id ? service : entry)
    );
  }

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="service-directory-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">Database configuration</p>
            <h2 id="service-directory-heading">Service drafts</h2>
            <p className="muted-copy">
              These records remain inactive in MCP routing until runtime activation is delivered.
            </p>
          </div>
          <div className="button-row">
            {role === "superadmin" && (
              <button type="button" onClick={() => setCreating((value) => !value)}>
                New service
              </button>
            )}
            <button type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
        {creating && role === "superadmin" && (
          <CreateServiceForm api={api} onCreated={(service) => {
            setCreating(false);
            void load(service.id);
          }} />
        )}
        <form className="filter-grid service-filters" onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}>
          <label>
            Search services
            <input
              value={query}
              maxLength={512}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Slug or name"
            />
          </label>
          <label>
            Lifecycle
            <select
              value={lifecycle}
              onChange={(event) => setLifecycle(event.target.value as ServiceLifecycle | "")}
            >
              <option value="">All states</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </form>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {loading ? (
          <p role="status">Loading services…</p>
        ) : services.length === 0 ? (
          <p className="muted-copy">No visible services match these filters.</p>
        ) : (
          <div className="service-layout">
            <div className="service-list" aria-label="Visible services">
              {services.map((service) => (
                <button
                  type="button"
                  className={`service-card${service.id === selectedId ? " selected" : ""}`}
                  aria-pressed={service.id === selectedId}
                  key={service.id}
                  onClick={() => setSelectedId(service.id)}
                >
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.slug}</small>
                  </span>
                  <span className={`state-label state-${service.lifecycle}`}>
                    {label(service.lifecycle)}
                  </span>
                </button>
              ))}
            </div>
            {selectedId !== undefined && (
              <ServiceWorkspace
                key={selectedId}
                role={role}
                serviceId={selectedId}
                api={api}
                onChanged={replaceSummary}
                onDeleted={() => void load()}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CreateServiceForm({
  api,
  onCreated,
}: {
  api: ServiceControlApi;
  onCreated: (service: ControlService) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <form className="profile-form inset-form" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      void api.createService({ slug, name }).then(onCreated, (caught) => {
        setError(messageFor(caught));
      });
    }}>
      <h3>Create a non-routable draft</h3>
      <div className="field-pair">
        <label>
          Stable slug
          <input
            required
            pattern="[a-z][a-z0-9-]{0,63}"
            maxLength={64}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
        <label>
          Service name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <button type="submit">Create service draft</button>
    </form>
  );
}

function ServiceWorkspace({
  role,
  serviceId,
  api,
  onChanged,
  onDeleted,
}: {
  role: UserRole;
  serviceId: string;
  api: ServiceControlApi;
  onChanged: (service: ControlService) => void;
  onDeleted: () => void;
}) {
  const [service, setService] = useState<ControlServiceDetail>();
  const [revisions, setRevisions] = useState<ServiceRevision[]>([]);
  const [admins, setAdmins] = useState<ServiceAdmin[]>([]);
  const [validation, setValidation] = useState<ServiceValidation>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [detail, history, ownership] = await Promise.all([
        api.service(serviceId),
        api.serviceRevisions(serviceId),
        api.serviceAdmins(serviceId),
      ]);
      setService(detail);
      setRevisions(history.revisions);
      setAdmins(ownership.admins);
      setValidation(undefined);
      onChanged(detail);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [serviceId]);

  async function apply(
    operation: () => Promise<ControlServiceDetail>,
    success: string,
  ) {
    setError("");
    setNotice("");
    try {
      const changed = await operation();
      setService(changed);
      setValidation(undefined);
      setNotice(success);
      onChanged(changed);
      const [history, ownership] = await Promise.all([
        api.serviceRevisions(changed.id),
        api.serviceAdmins(changed.id),
      ]);
      setRevisions(history.revisions);
      setAdmins(ownership.admins);
    } catch (caught) {
      setError(messageFor(caught));
      throw caught;
    }
  }

  if (loading) return <p role="status">Loading service configuration…</p>;
  if (service === undefined) {
    return <p className="form-error" role="alert">{error || "Service unavailable."}</p>;
  }

  const canConfigure = role === "admin" || role === "superadmin";
  const isSuperadmin = role === "superadmin";
  return (
    <article className="service-workspace" aria-labelledby="selected-service-heading">
      <header className="service-workspace-header">
        <div>
          <p className="card-kicker">{service.slug}</p>
          <h3 id="selected-service-heading">{service.name}</h3>
        </div>
        <div className="service-statuses">
          <span className={`state-label state-${service.lifecycle}`}>
            {label(service.lifecycle)}
          </span>
          <span className="state-label">
            {service.lifecycle === "draft"
              ? "Not published"
              : service.draft_matches_published
                ? "Published draft current"
                : "Unpublished changes"}
          </span>
        </div>
      </header>
      <nav className="service-section-nav" aria-label="Service editor sections">
        <a href="#service-basics">Basics</a>
        <a href="#service-destinations">Destinations</a>
        <a href="#service-publication">Publication</a>
        <a href="#service-history">History</a>
        <a href="#service-transfer">Safe transfer</a>
        {isSuperadmin && <a href="#service-ownership">Ownership</a>}
        {isSuperadmin && <a href="#service-lifecycle">Lifecycle</a>}
      </nav>
      {notice !== "" && <p className="success-copy" role="status">{notice}</p>}
      {error !== "" && (
        <div className="form-error" role="alert">
          <p>{error}</p>
          {error.includes("Refresh") && (
            <button type="button" onClick={() => void load()}>Refresh current version</button>
          )}
        </div>
      )}
      <section id="service-basics" className="editor-card">
        <h4>Basics</h4>
        <ProfileEditor
          service={service}
          disabled={!canConfigure || service.lifecycle === "archived"}
          onSave={(input) => apply(
            () => api.updateService(service, input),
            "Service profile draft saved.",
          )}
        />
      </section>
      <section id="service-destinations" className="editor-card">
        <h4>Destinations</h4>
        <p className="muted-copy">
          Routing constraints are validated locally. No network probe is performed.
        </p>
        <div className="destination-stack">
          {service.destinations.map((destination) => (
            <DestinationEditor
              key={destination.id}
              destination={destination}
              disabled={!canConfigure || service.lifecycle === "archived"}
              onSave={(input) => apply(
                () => api.updateDestination(service, destination.id, input),
                `${destination.slug} destination saved.`,
              )}
              onRemove={() => apply(
                () => api.deleteDestination(service, destination.id),
                `${destination.slug} destination removed.`,
              )}
            />
          ))}
          {service.destinations.length === 0 && (
            <p className="muted-copy">No destination has been configured.</p>
          )}
        </div>
        {canConfigure && service.lifecycle !== "archived" && (
          <NewDestinationForm onCreate={(input) => apply(
            () => api.createDestination(service, input),
            "Destination added to the draft.",
          )} />
        )}
      </section>
      <section id="service-publication" className="editor-card">
        <div className="section-toolbar">
          <div>
            <h4>Validation and publication</h4>
            <p className="muted-copy">
              Publication creates one immutable snapshot; it does not activate database routing yet.
            </p>
          </div>
          {canConfigure && service.lifecycle !== "archived" && (
            <div className="button-row">
              <button type="button" onClick={() => {
                setError("");
                void api.validateService(service.id).then(setValidation, (caught) => {
                  setError(messageFor(caught));
                });
              }}>
                Validate draft
              </button>
              <button type="button" onClick={() => void apply(
                () => api.publishService(service),
                "Immutable revision published.",
              ).catch(() => undefined)}>
                Publish draft
              </button>
            </div>
          )}
        </div>
        <ValidationSummary validation={validation} service={service} />
      </section>
      <section id="service-history" className="editor-card">
        <h4>Immutable history</h4>
        {revisions.length === 0 ? (
          <p className="muted-copy">No published revisions yet.</p>
        ) : (
          <ol className="revision-list">
            {revisions.map((revision) => (
              <li key={revision.id}>
                <span>
                  <strong>Revision {revision.sequence}</strong>
                  <small>
                    Generation {revision.publication_generation} · {revision.actor_role}
                    {revision.source_revision_id === undefined ? "" : " · rollback"}
                  </small>
                </span>
                {canConfigure && service.lifecycle !== "archived" && (
                  <JustifiedAction
                    buttonLabel={`Roll back to revision ${revision.sequence}`}
                    heading={`Publish revision ${revision.sequence} again?`}
                    consequence="This appends a new revision and replaces the mutable draft."
                    onConfirm={(justification) => apply(
                      () => api.rollbackService(service, revision.id, justification),
                      `Revision ${revision.sequence} restored as a new publication.`,
                    )}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section id="service-transfer" className="editor-card">
        <SafeTransfer
          role={role}
          service={service}
          api={api}
          onImported={(document) => apply(
            () => api.importService(service, document),
            "Canonical draft imported.",
          )}
        />
      </section>
      {isSuperadmin && (
        <section id="service-ownership" className="editor-card">
          <OwnershipEditor
            service={service}
            admins={admins}
            api={api}
            apply={apply}
          />
        </section>
      )}
      {isSuperadmin && (
        <section id="service-lifecycle" className="editor-card danger-zone">
          <LifecycleEditor
            service={service}
            api={api}
            apply={apply}
            onDeleted={onDeleted}
          />
        </section>
      )}
    </article>
  );
}

function ProfileEditor({
  service,
  disabled,
  onSave,
}: {
  service: ControlServiceDetail;
  disabled: boolean;
  onSave: (
    input: {
      name: string;
      description?: string | null;
      documentation_url?: string | null;
    },
  ) => Promise<void>;
}) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [documentationUrl, setDocumentationUrl] = useState(service.documentation_url ?? "");
  return (
    <form className="profile-form" onSubmit={(event) => {
      event.preventDefault();
      void onSave({
        name,
        ...(description.trim() === ""
          ? service.description === undefined ? {} : { description: null }
          : { description: description.trim() }),
        ...(documentationUrl.trim() === ""
          ? service.documentation_url === undefined ? {} : { documentation_url: null }
          : { documentation_url: documentationUrl.trim() }),
      }).catch(() => undefined);
    }}>
      <div className="field-pair">
        <label>
          Service name
          <input
            required
            maxLength={120}
            disabled={disabled}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Stable slug
          <input value={service.slug} disabled aria-describedby="stable-slug-note" />
          <small id="stable-slug-note">The slug cannot be changed.</small>
        </label>
      </div>
      <label>
        Description
        <textarea
          maxLength={1024}
          disabled={disabled}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        Documentation URL
        <input
          type="url"
          maxLength={2048}
          disabled={disabled}
          value={documentationUrl}
          onChange={(event) => setDocumentationUrl(event.target.value)}
        />
      </label>
      {!disabled && <button type="submit">Save service basics</button>}
    </form>
  );
}

function DestinationEditor({
  destination,
  disabled,
  onSave,
  onRemove,
}: {
  destination: ServiceDestination;
  disabled: boolean;
  onSave: (input: Omit<ServiceDestinationInput, "slug">) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = useState(destination.base_url);
  const [schemes, setSchemes] = useState(destination.schemes.join(", "));
  const [hosts, setHosts] = useState(
    destination.hosts.map((host) => `${host.type}:${host.value}`).join("\n"),
  );
  const [ports, setPorts] = useState(destination.ports.join(", "));
  const [tlsVerify, setTlsVerify] = useState(destination.tls_verify);
  const [error, setError] = useState("");
  return (
    <form className="destination-card" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      const parsedSchemes = schemes.split(",").map((value) => value.trim()).filter(Boolean);
      const parsedHosts = hosts.split("\n").map((value) => value.trim()).filter(Boolean)
        .map((value) => {
          const separator = value.indexOf(":");
          return {
            type: value.slice(0, separator),
            value: value.slice(separator + 1),
          };
        });
      const parsedPorts = ports.split(",").map((value) => Number(value.trim()));
      if (
        parsedSchemes.length === 0 ||
        parsedSchemes.some((value) => value !== "http" && value !== "https") ||
        parsedHosts.length === 0 ||
        parsedHosts.some(({ type, value }) =>
          !["exact", "suffix", "regex"].includes(type) || value === "") ||
        parsedPorts.length === 0 ||
        parsedPorts.some((value) =>
          !Number.isInteger(value) || value < 1 || value > 65_535)
      ) {
        setError("Schemes, host matchers, and ports must use the documented bounded format.");
        return;
      }
      void onSave({
        base_url: baseUrl,
        schemes: parsedSchemes as Array<"http" | "https">,
        hosts: parsedHosts as ServiceDestinationInput["hosts"],
        ports: parsedPorts,
        tls_verify: tlsVerify,
      }).catch(() => undefined);
    }}>
      <div className="section-toolbar">
        <h5>{destination.slug}</h5>
        {!tlsVerify && <span className="warning-label">TLS verification disabled</span>}
      </div>
      <div className="destination-fields">
        <label>
          Base URL
          <input
            required
            type="url"
            maxLength={2048}
            disabled={disabled}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <label>
          Allowed schemes (comma-separated)
          <input
            required
            disabled={disabled}
            value={schemes}
            onChange={(event) => setSchemes(event.target.value)}
          />
        </label>
        <label>
          Host matchers (one type:value per line)
          <textarea
            required
            maxLength={8_224}
            disabled={disabled}
            value={hosts}
            onChange={(event) => setHosts(event.target.value)}
          />
        </label>
        <label>
          Allowed ports (comma-separated)
          <input
            required
            disabled={disabled}
            value={ports}
            onChange={(event) => setPorts(event.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            disabled={disabled}
            checked={tlsVerify}
            onChange={(event) => setTlsVerify(event.target.checked)}
          />
          Verify downstream TLS
        </label>
      </div>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      {!disabled && (
        <div className="button-row">
          <button type="submit">Save {destination.slug} destination</button>
          <button className="danger-button" type="button" onClick={() => {
            void onRemove().catch(() => undefined);
          }}>
            Remove {destination.slug}
          </button>
        </div>
      )}
    </form>
  );
}

function NewDestinationForm({
  onCreate,
}: {
  onCreate: (input: ServiceDestinationInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("443");
  const [tlsVerify, setTlsVerify] = useState(true);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>Add destination</button>;
  }
  return (
    <form className="destination-card" onSubmit={(event) => {
      event.preventDefault();
      const url = new URL(baseUrl);
      void onCreate({
        slug,
        base_url: baseUrl,
        schemes: [url.protocol === "http:" ? "http" : "https"],
        hosts: [{ type: "exact", value: host }],
        ports: [Number(port)],
        tls_verify: tlsVerify,
      }).then(() => setOpen(false), () => undefined);
    }}>
      <h5>New destination</h5>
      <div className="destination-fields">
        <label>
          Destination slug
          <input
            required
            pattern="[a-z][a-z0-9-]{0,63}"
            maxLength={64}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
        <label>
          Base URL
          <input
            required
            type="url"
            maxLength={2048}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <label>
          Exact allowed host
          <input
            required
            maxLength={253}
            value={host}
            onChange={(event) => setHost(event.target.value)}
          />
        </label>
        <label>
          Allowed port
          <input
            required
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(event) => setPort(event.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={tlsVerify}
            onChange={(event) => setTlsVerify(event.target.checked)}
          />
          Verify downstream TLS
        </label>
      </div>
      {!tlsVerify && (
        <p className="warning-copy" role="alert">
          TLS verification is disabled. The connection cannot verify the downstream identity.
        </p>
      )}
      <div className="button-row">
        <button type="submit">Create destination</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function ValidationSummary({
  validation,
  service,
}: {
  validation: ServiceValidation | undefined;
  service: ControlServiceDetail;
}) {
  const tlsDisabled = service.destinations.some(({ tls_verify }) => !tls_verify);
  if (validation === undefined && !tlsDisabled) {
    return <p className="muted-copy">Run validation before publishing.</p>;
  }
  return (
    <div className="validation-summary" aria-live="polite">
      {validation !== undefined && (
        <>
          <strong>{validation.valid ? "Draft is publishable" : "Draft needs attention"}</strong>
          {validation.issues.map((issue) => (
            <p key={issue.pointer}>{validationIssue(issue.code)}</p>
          ))}
        </>
      )}
      {(tlsDisabled || (validation?.warnings.length ?? 0) > 0) && (
        <p className="warning-copy">
          At least one destination disables TLS verification. Publication preserves that choice.
        </p>
      )}
    </div>
  );
}

function SafeTransfer({
  role,
  service,
  api,
  onImported,
}: {
  role: UserRole;
  service: ControlServiceDetail;
  api: ServiceControlApi;
  onImported: (document: ServiceDraftDocument) => Promise<void>;
}) {
  const [copyText, setCopyText] = useState("");
  const [importText, setImportText] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canConfigure = role === "admin" || role === "superadmin";
  return (
    <>
      <h4>Safe copy, import, and clone</h4>
      <p className="muted-copy">
        Canonical transfer includes profile and destinations only. Credential values,
        administrators, principals, policies, history, OAuth state, and runtime references
        are excluded.
      </p>
      <div className="button-row">
        <button type="button" onClick={() => {
          setError("");
          void api.copyService(service.id).then((document) => {
            setCopyText(JSON.stringify(document, null, 2));
            setNotice("Secret-free canonical document prepared.");
          }, (caught) => setError(messageFor(caught)));
        }}>
          Prepare safe copy
        </button>
      </div>
      {copyText !== "" && (
        <label>
          Canonical copy document
          <textarea
            className="code-input"
            readOnly
            rows={10}
            value={copyText}
            aria-describedby="copy-exclusions"
          />
          <small id="copy-exclusions">Review and copy this non-secret document manually.</small>
        </label>
      )}
      {canConfigure && service.lifecycle !== "archived" && (
        <form className="profile-form" onSubmit={(event) => {
          event.preventDefault();
          setError("");
          try {
            const document = JSON.parse(importText) as ServiceDraftDocument;
            void onImported(document).then(() => {
              setImportText("");
              setNotice("Canonical document imported; submitted text was cleared.");
            }, () => undefined);
          } catch {
            setError("The import must be one valid canonical JSON document.");
          }
        }}>
          <label>
            Canonical import document
            <textarea
              className="code-input"
              required
              maxLength={131_072}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
            />
          </label>
          <button type="submit">Import safe draft</button>
        </form>
      )}
      {role === "superadmin" && (
        <form className="profile-form" onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api.cloneService(service.id, {
            slug: cloneSlug,
            name: cloneName,
          }).then((clone) => {
            setNotice(`Created isolated draft ${clone.slug}.`);
            setCloneSlug("");
            setCloneName("");
          }, (caught) => setError(messageFor(caught)));
        }}>
          <h5>Clone as an isolated draft</h5>
          <div className="field-pair">
            <label>
              New slug
              <input
                required
                pattern="[a-z][a-z0-9-]{0,63}"
                maxLength={64}
                value={cloneSlug}
                onChange={(event) => setCloneSlug(event.target.value)}
              />
            </label>
            <label>
              New name
              <input
                required
                maxLength={120}
                value={cloneName}
                onChange={(event) => setCloneName(event.target.value)}
              />
            </label>
          </div>
          <button type="submit">Create secret-free clone</button>
        </form>
      )}
      {notice !== "" && <p className="success-copy" role="status">{notice}</p>}
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

function OwnershipEditor({
  service,
  admins,
  api,
  apply,
}: {
  service: ControlServiceDetail;
  admins: ServiceAdmin[];
  api: ServiceControlApi;
  apply: (operation: () => Promise<ControlServiceDetail>, success: string) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  return (
    <>
      <h4>Administrative ownership</h4>
      <ul className="compact-list">
        {admins.map((admin) => (
          <li key={admin.id}>
            <span>{admin.given_name} {admin.family_name} <small>{admin.email}</small></span>
            <JustifiedAction
              buttonLabel={`Remove ${admin.email}`}
              heading={`Remove ${admin.email} from ${service.slug}?`}
              consequence="This immediately removes administrative access to this service."
              onConfirm={(justification) => apply(
                () => api.removeServiceAdmin(service, admin.id, justification),
                `${admin.email} removed from service administration.`,
              )}
            />
          </li>
        ))}
      </ul>
      <form className="profile-form" onSubmit={(event) => {
        event.preventDefault();
        void apply(
          () => api.assignServiceAdmin(service, userId),
          "Administrator assigned.",
        ).then(() => setUserId(""), () => undefined);
      }}>
        <label>
          Active administrator user ID
          <input
            required
            type="text"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
        </label>
        <button type="submit">Assign administrator</button>
      </form>
    </>
  );
}

function LifecycleEditor({
  service,
  api,
  apply,
  onDeleted,
}: {
  service: ControlServiceDetail;
  api: ServiceControlApi;
  apply: (operation: () => Promise<ControlServiceDetail>, success: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [justification, setJustification] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <h4>Lifecycle and deletion</h4>
      {service.lifecycle !== "archived" ? (
        <JustifiedAction
          buttonLabel={`Archive ${service.slug}`}
          heading={`Archive ${service.slug}?`}
          consequence="Publication intent is disabled and an invalidation event is emitted."
          onConfirm={(reason) => apply(
            () => api.archiveService(service, reason),
            `${service.slug} archived.`,
          )}
        />
      ) : (
        <form className="confirmation-panel" onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api.deleteService(service, justification, password, totp).then(() => {
            setPassword("");
            setTotp("");
            onDeleted();
          }, (caught) => {
            setPassword("");
            setTotp("");
            setError(messageFor(caught));
          });
        }}>
          <h5>Permanently delete {service.slug}</h5>
          <p>
            This permanently removes the archived service, destinations, and retained
            revisions. The audit and final invalidation evidence remain.
          </p>
          <p className="muted-copy">
            Deletion requires zero assigned administrators and fresh password plus TOTP
            verification bound to this exact operation.
          </p>
          <label>
            Type {service.slug} to confirm
            <input
              required
              autoComplete="off"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          <label>
            Deletion justification
            <textarea
              required
              maxLength={1024}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          </label>
          <div className="field-pair">
            <label>
              Current password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Current TOTP code
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={totp}
                onChange={(event) => setTotp(event.target.value)}
              />
            </label>
          </div>
          {error !== "" && <p className="form-error" role="alert">{error}</p>}
          <button className="danger-button" type="submit" disabled={confirm !== service.slug}>
            Permanently delete {service.slug}
          </button>
        </form>
      )}
    </>
  );
}

function JustifiedAction({
  buttonLabel,
  heading,
  consequence,
  onConfirm,
}: {
  buttonLabel: string;
  heading: string;
  consequence: string;
  onConfirm: (justification: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState("");
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>{buttonLabel}</button>;
  }
  return (
    <form className="confirmation-panel" role="dialog" aria-label={heading} onSubmit={(event) => {
      event.preventDefault();
      void onConfirm(justification).then(() => setOpen(false), () => undefined);
    }}>
      <h5>{heading}</h5>
      <p>{consequence}</p>
      <label>
        Justification
        <textarea
          required
          maxLength={1024}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </label>
      <div className="button-row">
        <button type="submit">Confirm action</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function validationIssue(code: ServiceValidation["issues"][number]["code"]): string {
  if (code === "service_admin_required") return "Assign at least one active administrator.";
  if (code === "destination_required") return "Configure at least one complete destination.";
  if (code === "credential_reconciliation_required") {
    return "Resolve pending credential vault work before publication.";
  }
  return "Archived services cannot be published.";
}

function messageFor(error: unknown): string {
  if (error instanceof ControlApiError && error.code === "stale_version") {
    return "The service changed on the server. Your non-secret edits remain here. Refresh before retrying.";
  }
  if (error instanceof ControlApiError && error.code === "step_up_required") {
    return "Fresh password and TOTP verification is required for this exact action.";
  }
  if (error instanceof ControlApiError) return error.message;
  return "The service action could not be completed.";
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
