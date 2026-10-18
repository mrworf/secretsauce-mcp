# Configuring a service

The API documentation link helps an LLM understand how to use the service. Allowed servers limit which servers and base paths may receive requests and credentials. Exact hostname matches only that hostname; suffix matches the named DNS domain and its subdomains; regular expression uses the configured expression against the hostname. Keep imported patterns unchanged unless you intend to change access.

Under Authentication, select where the client should place its credential reference. Header name, Query parameter name and Body field name follow that context; Other placement hint retains custom client hints. Text before and after the value becomes part of the placement template, including spaces. The example always uses `[credential value]` and never reveals the saved secret.

Let the gateway control this header is explicit and off by default. A supplied header must contain exactly one valid matching reference or the request is rejected. Extra text or duplicate headers are replaced with the configured template. The enforced reference cannot be used elsewhere. This option does not insert a missing header. Set/Replace/Delete value remains independent of saving a configuration draft.

Default policy applies only if no rule matches. Both Allow and Deny rules are possible with either default. A rule’s explanation describes why that rule allows or denies its matching request.
